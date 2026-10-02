-- Phase 4: protect public-profile discovery and add direct connection requests.

drop policy if exists "Users can view public profiles" on public.profiles;
create policy "Users can view public profiles"
on public.profiles
for select
using (auth.uid() is not null and is_public = true);

drop policy if exists "Users can view their own skill links" on public.profile_skills;
create policy "Users can view their own skill links"
on public.profile_skills
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = profile_skills.profile_id
      and p.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = profile_skills.profile_id
      and auth.uid() is not null
      and p.is_public = true
  )
);

create table if not exists public.connection_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint connection_requests_not_self check (sender_id <> receiver_id)
);

create unique index if not exists connection_requests_active_pair_idx
on public.connection_requests (
  least(sender_id, receiver_id),
  greatest(sender_id, receiver_id)
)
where status in ('pending', 'accepted');

create index if not exists connection_requests_sender_id_idx
on public.connection_requests(sender_id);

create index if not exists connection_requests_receiver_id_idx
on public.connection_requests(receiver_id);

alter table public.connection_requests enable row level security;

drop policy if exists "Users can view their connection requests" on public.connection_requests;
create policy "Users can view their connection requests"
on public.connection_requests
for select
using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "Users can send public profile connection requests" on public.connection_requests;
create policy "Users can send public profile connection requests"
on public.connection_requests
for insert
with check (
  auth.uid() = sender_id
  and sender_id <> receiver_id
  and status = 'pending'
  and exists (
    select 1
    from public.profiles p
    where p.user_id = receiver_id
      and p.is_public = true
  )
);

drop policy if exists "Receivers can respond to pending requests" on public.connection_requests;
create policy "Receivers can respond to pending requests"
on public.connection_requests
for update
using (auth.uid() = receiver_id and status = 'pending')
with check (auth.uid() = receiver_id and status in ('accepted', 'rejected'));

create or replace function public.guard_connection_request_update()
returns trigger as $$
begin
  if new.sender_id is distinct from old.sender_id
    or new.receiver_id is distinct from old.receiver_id then
    raise exception 'Connection request participants cannot be changed';
  end if;

  if old.status <> 'pending' or new.status not in ('accepted', 'rejected') then
    raise exception 'Only a pending connection request can be accepted or rejected';
  end if;

  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists connection_requests_guard_update on public.connection_requests;
create trigger connection_requests_guard_update
before update on public.connection_requests
for each row
execute function public.guard_connection_request_update();
