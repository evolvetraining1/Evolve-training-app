create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),

  coach_id uuid not null
    references auth.users(id) on delete cascade,

  athlete_id uuid not null
    references auth.users(id) on delete cascade,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint conversations_distinct_users
    check (coach_id <> athlete_id),

  constraint conversations_unique_pair
    unique (coach_id, athlete_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),

  conversation_id uuid not null
    references public.conversations(id) on delete cascade,

  sender_id uuid not null
    references auth.users(id) on delete cascade,

  type text not null default 'text'
    check (
      type in (
        'text',
        'image',
        'video',
        'audio',
        'call'
      )
    ),

  content text,
  media_url text,

  media_duration integer
    check (
      media_duration is null
      or media_duration >= 0
    ),

  created_at timestamptz not null default now(),

  read_at timestamptz,

  constraint messages_content_or_media
  check (
    (
      type = 'text'
      and content is not null
      and length(trim(content)) > 0
    )
    or (
      type in ('image', 'video', 'audio')
      and media_url is not null
    )
    or type = 'call'
  )
);

create index if not exists conversations_coach_idx
on public.conversations(coach_id);

create index if not exists conversations_athlete_idx
on public.conversations(athlete_id);

create index if not exists messages_conversation_created_idx
on public.messages(conversation_id, created_at desc);

create index if not exists messages_sender_idx
on public.messages(sender_id);


alter table public.conversations enable row level security;
alter table public.messages enable row level security;


create policy conversations_read_members
on public.conversations
for select
to authenticated
using (
  auth.uid() = coach_id
  or auth.uid() = athlete_id
);


create policy conversations_create_active_relationship
on public.conversations
for insert
to authenticated
with check (
  (
    auth.uid() = coach_id
    or auth.uid() = athlete_id
  )
  and exists (
    select 1
    from public.coach_athlete_relationships r
    where r.coach_id = conversations.coach_id
      and r.athlete_id = conversations.athlete_id
      and r.status::text = 'active'
  )
);


create policy messages_read_members
on public.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and (
        c.coach_id = auth.uid()
        or c.athlete_id = auth.uid()
      )
  )
);


create policy messages_send_members
on public.messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and (
        c.coach_id = auth.uid()
        or c.athlete_id = auth.uid()
      )
  )
);


create policy messages_delete_own
on public.messages
for delete
to authenticated
using (
  sender_id = auth.uid()
);


do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime
    add table public.messages;
  end if;
end $$;
