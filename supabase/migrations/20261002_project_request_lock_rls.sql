-- The request trigger must lock readable projects even though only owners may update them.
-- Its explicit auth.uid() checks continue to enforce who may request or decide.
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
