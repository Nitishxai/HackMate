-- Owners may update project details and skill requirements atomically.
create or replace function public.update_hackathon_project(
  p_project_id uuid,
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
  project_row public.projects%rowtype;
  clean_title text;
  clean_description text;
  clean_skill text;
  skill_id uuid;
  occupied_member_count integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Sign in to edit a project.';
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
  if p_hackathon_url is not null
    and trim(p_hackathon_url) <> ''
    and trim(p_hackathon_url) !~* '^https?://' then
    raise exception 'Hackathon URL must be a valid http or https URL.';
  end if;

  select * into project_row
  from public.projects
  where id = p_project_id
    and owner_id = auth.uid()
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'Project not found or you are not its owner.';
  end if;

  select count(*) + 1 into occupied_member_count
  from public.project_members pm
  where pm.project_id = p_project_id
    and pm.status = 'accepted'
    and pm.user_id <> project_row.owner_id;

  if p_team_size < occupied_member_count then
    raise exception 'Team size cannot be less than the current number of accepted members.';
  end if;

  update public.projects
  set title = clean_title,
      description = clean_description,
      hackathon_name = nullif(trim(coalesce(p_hackathon_name, '')), ''),
      hackathon_url = nullif(trim(coalesce(p_hackathon_url, '')), ''),
      team_size = p_team_size,
      status = p_status
  where id = p_project_id
    and owner_id = auth.uid();

  delete from public.project_skills
  where project_id = p_project_id;

  for clean_skill in
    select min(regexp_replace(trim(skill), '\s+', ' ', 'g'))
    from unnest(coalesce(p_skills, array[]::text[])) as skill
    where trim(skill) <> ''
    group by lower(regexp_replace(trim(skill), '\s+', ' ', 'g'))
  loop
    select id into skill_id
    from public.skills
    where lower(regexp_replace(trim(name), '\s+', ' ', 'g')) =
      lower(regexp_replace(trim(clean_skill), '\s+', ' ', 'g'))
    limit 1;

    if skill_id is null then
      begin
        insert into public.skills (name)
        values (clean_skill)
        returning id into skill_id;
      exception when unique_violation then
        select id into skill_id
        from public.skills
        where lower(regexp_replace(trim(name), '\s+', ' ', 'g')) =
          lower(regexp_replace(trim(clean_skill), '\s+', ' ', 'g'))
        limit 1;
        if skill_id is null then
          raise;
        end if;
      end;
    end if;

    insert into public.project_skills (project_id, skill_id)
    values (p_project_id, skill_id);
    skill_id := null;
  end loop;

  return p_project_id;
end;
$$;

revoke all on function public.update_hackathon_project(uuid, text, text, text, text, integer, text, text[]) from public;
grant execute on function public.update_hackathon_project(uuid, text, text, text, text, integer, text, text[]) to authenticated;
