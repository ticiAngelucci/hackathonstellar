-- MVP directo desde Expo a Supabase. Estas políticas públicas deben
-- reemplazarse por políticas basadas en auth.uid() cuando Auth esté integrado.
create extension if not exists pgcrypto;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  creator_id uuid not null,
  status text not null default 'draft' check (status = 'draft'),
  created_at timestamptz not null default now(),
  participants jsonb not null default '[]'::jsonb
    check (jsonb_typeof(participants) = 'array')
);

create index if not exists events_created_at_idx
  on public.events (created_at desc);

alter table public.events enable row level security;

grant select, insert on public.events to anon, authenticated;

drop policy if exists "events_demo_read" on public.events;
create policy "events_demo_read"
  on public.events
  for select
  to anon, authenticated
  using (true);

drop policy if exists "events_demo_insert" on public.events;
create policy "events_demo_insert"
  on public.events
  for insert
  to anon, authenticated
  with check (
    status = 'draft'
    and jsonb_array_length(participants) >= 1
  );
