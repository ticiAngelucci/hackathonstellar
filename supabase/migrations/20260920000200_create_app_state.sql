-- Estado real consumido por Expo. No contiene seeds ni datos de demostración.
-- Las políticas anónimas permiten el MVP sin Auth; antes de producción deben
-- reemplazarse por políticas con auth.uid() = user_id.

create table if not exists public.wallets (
  user_id uuid primary key,
  balance numeric(20, 7) not null default 0 check (balance >= 0),
  asset text not null default 'USDC' check (asset = 'USDC'),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  event_id uuid references public.events(id) on delete set null,
  title text not null check (char_length(title) between 1 and 120),
  subtitle text,
  amount numeric(20, 7) not null,
  status text not null check (status in ('paid', 'pending', 'auto', 'blocked', 'received')),
  icon text not null default 'receipt',
  tx_hash text,
  created_at timestamptz not null default now()
);

create index if not exists transactions_user_created_at_idx
  on public.transactions (user_id, created_at desc);

create table if not exists public.service_subscriptions (
  user_id uuid not null,
  service_id text not null check (char_length(service_id) between 1 and 64),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, service_id)
);

create table if not exists public.payment_policies (
  user_id uuid primary key,
  auto_pay_limit numeric(20, 7) not null default 5 check (auto_pay_limit >= 0),
  approval_limit numeric(20, 7) not null default 30 check (approval_limit >= 0),
  block_above numeric(20, 7) not null default 30 check (block_above >= 0),
  daily_limit numeric(20, 7) not null default 50 check (daily_limit >= 0),
  allowed_recipients_only boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.wallets enable row level security;
alter table public.transactions enable row level security;
alter table public.service_subscriptions enable row level security;
alter table public.payment_policies enable row level security;

grant select on public.wallets, public.transactions to anon, authenticated;
grant select, insert, update on public.service_subscriptions, public.payment_policies to anon, authenticated;

drop policy if exists "wallets_demo_read" on public.wallets;
create policy "wallets_demo_read" on public.wallets
  for select to anon, authenticated using (true);

drop policy if exists "transactions_demo_read" on public.transactions;
create policy "transactions_demo_read" on public.transactions
  for select to anon, authenticated using (true);

drop policy if exists "subscriptions_demo_access" on public.service_subscriptions;
create policy "subscriptions_demo_access" on public.service_subscriptions
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "payment_policies_demo_access" on public.payment_policies;
create policy "payment_policies_demo_access" on public.payment_policies
  for all to anon, authenticated using (true) with check (true);
