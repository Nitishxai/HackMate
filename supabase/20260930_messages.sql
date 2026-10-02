-- Phase 5: authenticated 1-to-1 messages for accepted connections only.

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  constraint messages_non_empty_content check (
    length(trim(content)) > 0
    and content ~ '[^[:space:]]'
  ),
  constraint messages_not_self check (sender_id <> receiver_id)
);

create index if not exists messages_sender_created_at_idx
on public.messages(sender_id, created_at desc);

create index if not exists messages_receiver_created_at_idx
on public.messages(receiver_id, created_at desc);

create index if not exists messages_created_at_idx
on public.messages(created_at desc);

alter table public.messages enable row level security;

revoke all on public.messages from anon, authenticated;
grant select, insert on public.messages to authenticated;

drop policy if exists "Users can read their own messages" on public.messages;
create policy "Users can read their own messages"
on public.messages
for select
to authenticated
using (sender_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists "Connected users can send messages" on public.messages;
create policy "Connected users can send messages"
on public.messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and receiver_id <> auth.uid()
  and length(trim(content)) > 0
  and content ~ '[^[:space:]]'
  and exists (
    select 1
    from public.connection_requests cr
    where cr.status = 'accepted'
      and (
        (cr.sender_id = messages.sender_id and cr.receiver_id = messages.receiver_id)
        or
        (cr.sender_id = messages.receiver_id and cr.receiver_id = messages.sender_id)
      )
  )
);

drop policy if exists "Users can view profiles of connected users" on public.profiles;
create policy "Users can view profiles of connected users"
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.connection_requests cr
    where cr.status = 'accepted'
      and (
        (cr.sender_id = auth.uid() and cr.receiver_id = profiles.user_id)
        or
        (cr.receiver_id = auth.uid() and cr.sender_id = profiles.user_id)
      )
  )
);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'messages'
    ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end
$$;
