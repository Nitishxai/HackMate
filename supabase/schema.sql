-- HackMate Supabase database schema
-- Run this in the Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  username text not null unique,
  role text not null default 'Builder',
  bio text,
  experience text,
  github_url text,
  portfolio_url text,
  availability text not null default 'Available for hackathons',
  avatar_url text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.profile_skills (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, skill_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  slug text not null unique,
  description text not null,
  hackathon_name text,
  hackathon_url text,
  status text not null default 'open' check (status in ('open', 'forming', 'closed')),
  team_size integer not null check (team_size > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_skills (
  project_id uuid not null references public.projects(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, skill_id)
);

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  status text not null default 'accepted' check (status in ('pending', 'accepted', 'rejected')),
  joined_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table if not exists public.project_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_user_id_idx on public.profiles(user_id);
create index if not exists profile_skills_profile_id_idx on public.profile_skills(profile_id);
create index if not exists profile_skills_skill_id_idx on public.profile_skills(skill_id);
create index if not exists projects_owner_id_idx on public.projects(owner_id);
create index if not exists project_members_project_id_idx on public.project_members(project_id);
create index if not exists project_requests_project_id_idx on public.project_requests(project_id);
create index if not exists project_requests_requester_id_idx on public.project_requests(requester_id);

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
before update on public.profiles
for each row
execute function public.handle_updated_at();

create trigger projects_updated_at
before update on public.projects
for each row
execute function public.handle_updated_at();

create trigger project_requests_updated_at
before update on public.project_requests
for each row
execute function public.handle_updated_at();

alter table public.profiles enable row level security;
alter table public.skills enable row level security;
alter table public.profile_skills enable row level security;
alter table public.projects enable row level security;
alter table public.project_skills enable row level security;
alter table public.project_members enable row level security;
alter table public.project_requests enable row level security;

create policy "Users can view own profile"
on public.profiles
for select
using (auth.uid() = user_id);

create policy "Users can update own profile"
on public.profiles
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can insert own profile"
on public.profiles
for insert
with check (auth.uid() = user_id);

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

create policy "Users can manage their own skill links"
on public.profile_skills
for insert
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = profile_skills.profile_id
      and p.user_id = auth.uid()
  )
);

create policy "Users can delete their own skill links"
on public.profile_skills
for delete
using (
  exists (
    select 1
    from public.profiles p
    where p.id = profile_skills.profile_id
      and p.user_id = auth.uid()
  )
);

create policy "Anyone can view skills catalog"
on public.skills
for select
using (true);

create policy "Authenticated users can insert skills"
on public.skills
for insert
with check (auth.role() = 'authenticated');

create policy "Authenticated users can view open project info"
on public.projects
for select
using (
  auth.role() = 'authenticated'
  and (
    status in ('open', 'forming')
    or owner_id = auth.uid()
  )
);

create policy "Authenticated users can create projects"
on public.projects
for insert
with check (auth.role() = 'authenticated' and owner_id = auth.uid());

create policy "Owners can update their projects"
on public.projects
for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Owners can delete their projects"
on public.projects
for delete
using (owner_id = auth.uid());

create policy "Users can view project skills"
on public.project_skills
for select
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_skills.project_id
      and (
        p.status in ('open', 'forming')
        or p.owner_id = auth.uid()
      )
  )
);

create policy "Owners can manage project skill requirements"
on public.project_skills
for insert
with check (
  exists (
    select 1
    from public.projects p
    where p.id = project_skills.project_id
      and p.owner_id = auth.uid()
  )
);

create policy "Owners can delete project skill requirements"
on public.project_skills
for delete
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_skills.project_id
      and p.owner_id = auth.uid()
  )
);

create policy "Users can view project members"
on public.project_members
for select
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.projects p
    where p.id = project_members.project_id
      and p.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.projects p
    where p.id = project_members.project_id
      and p.status in ('open', 'forming')
  )
);

create policy "Owners can manage project members"
on public.project_members
for insert
with check (
  exists (
    select 1
    from public.projects p
    where p.id = project_members.project_id
      and p.owner_id = auth.uid()
  )
);

create policy "Owners can update project members"
on public.project_members
for update
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_members.project_id
      and p.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.projects p
    where p.id = project_members.project_id
      and p.owner_id = auth.uid()
  )
);

create policy "Users can view project requests for their projects"
on public.project_requests
for select
using (
  requester_id = auth.uid()
  or exists (
    select 1
    from public.projects p
    where p.id = project_requests.project_id
      and p.owner_id = auth.uid()
  )
);

create policy "Users can create project join requests"
on public.project_requests
for insert
with check (
  auth.role() = 'authenticated'
  and requester_id = auth.uid()
);

create policy "Users can update their own request"
on public.project_requests
for update
using (requester_id = auth.uid())
with check (requester_id = auth.uid());

create policy "Owners can manage requests"
on public.project_requests
for update
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_requests.project_id
      and p.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.projects p
    where p.id = project_requests.project_id
      and p.owner_id = auth.uid()
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
