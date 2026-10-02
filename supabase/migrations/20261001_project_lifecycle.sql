-- Phase 7: make project visibility, join requests, and team formation safe at the database boundary.

do $$
begin
  if exists (
    select 1
    from public.project_requests
    where status in ('pending', 'accepted')
    group by project_id, requester_id
    having count(*) > 1
  ) then
    raise exception
      'Duplicate active project requests exist. Resolve duplicate pending/accepted rows before applying this migration.';
  end if;
end
$$;

create unique index if not exists project_requests_active_project_requester_idx
on public.project_requests(project_id, requester_id)
where status in ('pending', 'accepted');

create or replace function public.is_current_project_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = auth.uid()
      and pm.status = 'accepted'
  );
$$;

revoke all on function public.is_current_project_member(uuid) from public;
grant execute on function public.is_current_project_member(uuid) to authenticated;

drop policy if exists "Project members can view their projects" on public.projects;
create policy "Project members can view their projects"
on public.projects
for select
to authenticated
using (public.is_current_project_member(id));

drop policy if exists "Project members can view their teammates" on public.project_members;
create policy "Project members can view their teammates"
on public.project_members
for select
to authenticated
using (public.is_current_project_member(project_id));

drop policy if exists "Users can view project skills" on public.project_skills;
create policy "Users can view project skills"
on public.project_skills
for select
to authenticated
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_skills.project_id
      and (
        p.status in ('open', 'forming')
        or p.owner_id = auth.uid()
        or public.is_current_project_member(p.id)
      )
  )
);

create or replace function public.guard_project_request_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  project_row public.projects%rowtype;
  accepted_member_count integer;
  target_is_member boolean;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null
      or new.requester_id <> auth.uid()
      or new.status <> 'pending' then
      raise exception using errcode = '42501', message = 'Only the signed-in user can create a pending project request.';
    end if;

    select * into project_row
    from public.projects
    where id = new.project_id
    for update;

    if not found then
      raise exception 'Project not found.';
    end if;
    if project_row.owner_id = auth.uid() then
      raise exception 'Project owners cannot request to join their own project.';
    end if;
    if project_row.status not in ('open', 'forming') then
      raise exception 'This project is no longer accepting requests.';
    end if;

    select exists (
      select 1 from public.project_members pm
      where pm.project_id = new.project_id
        and pm.user_id = auth.uid()
        and pm.status = 'accepted'
    ) into target_is_member;

    if target_is_member then
      raise exception 'You are already a member of this project.';
    end if;

    select count(*) into accepted_member_count
    from public.project_members pm
    where pm.project_id = new.project_id
      and pm.status = 'accepted'
      and pm.user_id <> project_row.owner_id;
    accepted_member_count := accepted_member_count + 1;

    if accepted_member_count >= project_row.team_size then
      raise exception 'This project is already at full capacity.';
    end if;

    return new;
  end if;

  if new.project_id is distinct from old.project_id
    or new.requester_id is distinct from old.requester_id
    or new.message is distinct from old.message
    or old.status <> 'pending' then
    raise exception using errcode = '42501', message = 'Only a pending project request can be decided.';
  end if;

  select * into project_row
  from public.projects
  where id = old.project_id
  for update;

  if not found then
    raise exception 'Project not found.';
  end if;

  if auth.uid() = old.requester_id and new.status = 'cancelled' then
    return new;
  end if;

  if auth.uid() is distinct from project_row.owner_id
    or new.status not in ('accepted', 'rejected') then
    raise exception using errcode = '42501', message = 'Only the project owner can accept or reject a request.';
  end if;

  if new.status = 'accepted' then
    if project_row.status not in ('open', 'forming') then
      raise exception 'This project is no longer accepting members.';
    end if;

    select exists (
      select 1 from public.project_members pm
      where pm.project_id = old.project_id
        and pm.user_id = old.requester_id
        and pm.status = 'accepted'
    ) into target_is_member;

    if not target_is_member then
      select count(*) into accepted_member_count
      from public.project_members pm
      where pm.project_id = old.project_id
        and pm.status = 'accepted'
        and pm.user_id <> project_row.owner_id;
      accepted_member_count := accepted_member_count + 1;

      if accepted_member_count >= project_row.team_size then
        raise exception 'This project is already at full capacity.';
      end if;

      insert into public.project_members (project_id, user_id, role, status, joined_at)
      values (old.project_id, old.requester_id, 'member', 'accepted', now())
      on conflict (project_id, user_id)
      do update set
        role = 'member',
        status = 'accepted',
        joined_at = now();
    end if;
  end if;

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists project_requests_guard_lifecycle on public.project_requests;
create trigger project_requests_guard_lifecycle
before insert or update on public.project_requests
for each row
execute function public.guard_project_request_lifecycle();

create or replace function public.create_hackathon_project(
  p_title text,
  p_description text,
  p_hackathon_name text,
  p_hackathon_url text,
  p_team_size integer,
  p_status text,
  p_skills text[]
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  created_project_id uuid;
  clean_title text;
  clean_description text;
  clean_skill text;
  skill_id uuid;
  base_slug text;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Sign in to create a project.';
  end if;

  clean_title := trim(coalesce(p_title, ''));
  clean_description := trim(coalesce(p_description, ''));
  if clean_title = '' or clean_description = '' then
    raise exception 'Project name and description are required.';
  end if;
  if p_team_size is null or p_team_size < 1 then
    raise exception 'Team size must be at least one.';
  end if;
  if p_status not in ('open', 'forming', 'closed') then
    raise exception 'Project status is invalid.';
  end if;
  if coalesce(array_length(p_skills, 1), 0) = 0 then
    raise exception 'Add at least one required skill.';
  end if;

  base_slug := trim(both '-' from regexp_replace(lower(clean_title), '[^a-z0-9]+', '-', 'g'));
  if base_slug = '' then
    base_slug := 'project';
  end if;

  insert into public.projects (
    owner_id,
    title,
    slug,
    description,
    hackathon_name,
    hackathon_url,
    status,
    team_size
  )
  values (
    auth.uid(),
    clean_title,
    left(base_slug, 180) || '-' || substr(gen_random_uuid()::text, 1, 8),
    clean_description,
    nullif(trim(coalesce(p_hackathon_name, '')), ''),
    nullif(trim(coalesce(p_hackathon_url, '')), ''),
    p_status,
    p_team_size
  )
  returning id into created_project_id;

  insert into public.project_members (project_id, user_id, role, status)
  values (created_project_id, auth.uid(), 'owner', 'accepted');

  for clean_skill in
    select min(regexp_replace(trim(skill), '\s+', ' ', 'g'))
    from unnest(coalesce(p_skills, array[]::text[])) as skill
    where trim(skill) <> ''
    group by lower(regexp_replace(trim(skill), '\s+', ' ', 'g'))
  loop
    select id into skill_id
    from public.skills
    where lower(name) = lower(clean_skill)
    limit 1;

    if skill_id is null then
      begin
        insert into public.skills (name)
        values (clean_skill)
        returning id into skill_id;
      exception when unique_violation then
        select id into skill_id
        from public.skills
        where lower(name) = lower(clean_skill)
        limit 1;
        if skill_id is null then
          raise;
        end if;
      end;
    end if;

    insert into public.project_skills (project_id, skill_id)
    values (created_project_id, skill_id);
    skill_id := null;
  end loop;

  return created_project_id;
end;
$$;

revoke all on function public.create_hackathon_project(text, text, text, text, integer, text, text[]) from public;
grant execute on function public.create_hackathon_project(text, text, text, text, integer, text, text[]) to authenticated;
