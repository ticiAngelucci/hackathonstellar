-- PatoPay private application schema.
-- No passwords or service-role credentials belong in migrations.

create extension if not exists citext;
create extension if not exists pgcrypto;

create schema if not exists patopay;
revoke all on schema patopay from public, anon, authenticated;

create table if not exists patopay.profiles (
  id uuid primary key references auth.users(id),
  username citext unique,
  display_name text check (display_name is null or char_length(display_name) between 1 and 120),
  notifications_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create view patopay.profile_directory
with (security_invoker = true)
as
select id, username, display_name
from patopay.profiles;

create table if not exists patopay.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references patopay.profiles(id),
  name text not null check (char_length(name) between 1 and 100),
  status text not null default 'draft' check (status = 'draft'),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists patopay.event_participants (
  event_id uuid not null references patopay.events(id),
  user_id uuid not null references patopay.profiles(id),
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table if not exists patopay.assets (
  id uuid primary key default gen_random_uuid(),
  network text not null check (network = 'testnet'),
  contract_address text not null check (contract_address ~ '^C[A-Z2-7]{55}$'),
  code text not null check (char_length(code) between 1 and 12),
  decimals smallint not null check (decimals between 0 and 18),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (network, contract_address)
);

create table if not exists patopay.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references patopay.profiles(id),
  provider text not null check (provider in ('mock', 'stellar')),
  network text not null check (network in ('mock', 'testnet')),
  contract_address text not null,
  wallet_wasm_hash text,
  creation_tx_hash text,
  status text not null default 'unverified'
    check (status in ('unverified', 'active', 'disabled')),
  is_default boolean not null default false,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, network, contract_address)
);

create unique index if not exists wallets_one_default_per_user_network
  on patopay.wallets (user_id, network) where is_default and status <> 'disabled';

create table if not exists patopay.mock_wallet_balances (
  wallet_id uuid primary key references patopay.wallets(id),
  balance_minor bigint not null default 0 check (balance_minor >= 0),
  observed_at timestamptz not null default now()
);

create table if not exists patopay.payment_policy_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references patopay.profiles(id),
  version integer not null check (version >= 1),
  auto_pay_limit_minor bigint not null check (auto_pay_limit_minor between 0 and 9000000000000000),
  approval_limit_minor bigint not null check (approval_limit_minor between 0 and 9000000000000000),
  daily_limit_minor bigint not null check (daily_limit_minor between 1 and 9000000000000000),
  recipient_mode text not null check (recipient_mode in ('any', 'allowlist')),
  policy_contract_address text,
  on_chain_revision bigint,
  created_at timestamptz not null default now(),
  unique (user_id, version),
  check (auto_pay_limit_minor <= approval_limit_minor)
);

create table if not exists patopay.policy_allowed_recipients (
  policy_version_id uuid not null references patopay.payment_policy_versions(id),
  recipient_profile_id uuid not null references patopay.profiles(id),
  primary key (policy_version_id, recipient_profile_id)
);

create table if not exists patopay.policy_allowed_assets (
  policy_version_id uuid not null references patopay.payment_policy_versions(id),
  asset_id uuid not null references patopay.assets(id),
  primary key (policy_version_id, asset_id)
);

create table if not exists patopay.service_subscriptions (
  user_id uuid not null references patopay.profiles(id),
  service_id text not null check (char_length(service_id) between 1 and 64),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, service_id)
);

create table if not exists patopay.payment_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references patopay.profiles(id),
  payer_id uuid not null references patopay.profiles(id),
  source_wallet_id uuid not null references patopay.wallets(id),
  destination_wallet_id uuid not null references patopay.wallets(id),
  asset_id uuid not null references patopay.assets(id),
  amount_minor bigint not null check (amount_minor between 1 and 9000000000000000),
  memo text check (memo is null or char_length(memo) <= 500),
  policy_version_id uuid references patopay.payment_policy_versions(id),
  policy_snapshot jsonb not null default '{}'::jsonb,
  status text not null check (status in ('pending_approval', 'approved', 'rejected', 'expired', 'cancelled', 'blocked')),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> payer_id),
  check (source_wallet_id <> destination_wallet_id)
);

create table if not exists patopay.policy_decisions (
  id uuid primary key default gen_random_uuid(),
  payment_request_id uuid not null references patopay.payment_requests(id),
  actor_id uuid references patopay.profiles(id),
  source text not null check (source in ('engine', 'manual')),
  action text not null check (action in ('approve', 'reject', 'block', 'expire', 'cancel')),
  outcome text not null check (outcome in ('eligible_for_auto_approval', 'approval_required', 'blocked', 'approved', 'rejected')),
  reason_code text not null,
  policy_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists patopay.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  payment_request_id uuid not null references patopay.payment_requests(id),
  attempt_number integer not null check (attempt_number >= 1),
  executor text not null check (executor in ('mock', 'stellar')),
  mode text not null check (mode in ('mock', 'stellar')),
  status text not null check (status in ('prepared', 'submitting', 'submitted', 'confirmed', 'failed', 'unknown', 'simulated')),
  preparation_hash text,
  preparation_expires_at timestamptz,
  consumed_at timestamptz,
  envelope_hash text,
  tx_hash text unique,
  provider_reference text,
  ledger bigint,
  receipt jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payment_request_id, attempt_number),
  check (mode = executor)
);

create unique index if not exists payment_attempts_one_active
  on patopay.payment_attempts (payment_request_id)
  where status in ('prepared', 'submitting', 'submitted', 'unknown');

create table if not exists patopay.idempotency_keys (
  actor_id uuid not null references patopay.profiles(id),
  method text not null,
  path text not null,
  key text not null,
  request_hash text not null,
  response_status smallint,
  response_body jsonb,
  created_at timestamptz not null default now(),
  primary key (actor_id, method, path, key)
);

create index if not exists event_participants_user_idx
  on patopay.event_participants (user_id, event_id);
create index if not exists payment_requests_payer_status_idx
  on patopay.payment_requests (payer_id, status, created_at desc);
create index if not exists payment_requests_requester_status_idx
  on patopay.payment_requests (requester_id, status, created_at desc);
create index if not exists policy_decisions_request_created_idx
  on patopay.policy_decisions (payment_request_id, created_at desc);
create index if not exists payment_attempts_request_created_idx
  on patopay.payment_attempts (payment_request_id, created_at desc);

create or replace function patopay.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = patopay, public
as $$
begin
  insert into patopay.profiles (id, display_name)
  values (
    new.id,
    nullif(coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'name'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_patopay on auth.users;
create trigger on_auth_user_created_patopay
after insert on auth.users
for each row execute function patopay.handle_new_auth_user();

-- RLS is defense in depth. The application also scopes every use case.
-- request.jwt.claim.sub is set transaction-locally by the FastAPI UoW.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'events', 'event_participants', 'assets', 'wallets',
    'mock_wallet_balances', 'payment_policy_versions', 'policy_allowed_recipients',
    'policy_allowed_assets', 'service_subscriptions', 'payment_requests',
    'policy_decisions', 'payment_attempts', 'idempotency_keys'
  ] loop
    execute format('alter table patopay.%I enable row level security', table_name);
    execute format('alter table patopay.%I force row level security', table_name);
  end loop;
end
$$;

create policy profiles_authenticated_select on patopay.profiles
  for select to authenticated
  using (id = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid);
create policy profiles_authenticated_insert on patopay.profiles
  for insert to authenticated
  with check (id = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid);
create policy profiles_authenticated_update on patopay.profiles
  for update to authenticated
  using (id = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid)
  with check (id = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid);

create policy events_authenticated_access on patopay.events
  for all to authenticated
  using (
    owner_id = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    or exists (
      select 1 from patopay.event_participants p
      where p.event_id = id
        and p.user_id = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  )
  with check (owner_id = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid);
create policy participants_authenticated_access on patopay.event_participants
  for all to authenticated
  using (user_id = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid)
  with check (user_id = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid);

create policy assets_authenticated_select on patopay.assets
  for select to authenticated using (enabled);
create policy wallets_authenticated_access on patopay.wallets
  for all to authenticated
  using (user_id = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid)
  with check (user_id = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid);
create policy mock_balances_authenticated_access on patopay.mock_wallet_balances
  for all to authenticated
  using (exists (select 1 from patopay.wallets w where w.id = wallet_id and w.user_id = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid))
  with check (exists (select 1 from patopay.wallets w where w.id = wallet_id and w.user_id = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid));

create policy policies_authenticated_access on patopay.payment_policy_versions
  for all to authenticated
  using (user_id = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid)
  with check (user_id = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid);
create policy policy_recipients_authenticated_access on patopay.policy_allowed_recipients
  for all to authenticated
  using (exists (select 1 from patopay.payment_policy_versions p where p.id = policy_version_id and p.user_id = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid))
  with check (exists (select 1 from patopay.payment_policy_versions p where p.id = policy_version_id and p.user_id = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid));
create policy policy_assets_authenticated_access on patopay.policy_allowed_assets
  for all to authenticated
  using (exists (select 1 from patopay.payment_policy_versions p where p.id = policy_version_id and p.user_id = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid))
  with check (exists (select 1 from patopay.payment_policy_versions p where p.id = policy_version_id and p.user_id = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid));
create policy subscriptions_authenticated_access on patopay.service_subscriptions
  for all to authenticated
  using (user_id = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid)
  with check (user_id = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid);

create policy requests_authenticated_access on patopay.payment_requests
  for all to authenticated
  using (
    payer_id = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    or requester_id = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  )
  with check (requester_id = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid);
create policy decisions_authenticated_select on patopay.policy_decisions
  for select to authenticated
  using (exists (select 1 from patopay.payment_requests r where r.id = payment_request_id and (r.payer_id = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid or r.requester_id = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid)));
create policy decisions_authenticated_insert on patopay.policy_decisions
  for insert to authenticated
  with check (actor_id is null or actor_id = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid);
create policy attempts_authenticated_access on patopay.payment_attempts
  for all to authenticated
  using (exists (select 1 from patopay.payment_requests r where r.id = payment_request_id and (r.payer_id = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid or r.requester_id = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid)))
  with check (exists (select 1 from patopay.payment_requests r where r.id = payment_request_id and r.payer_id = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid));
create policy idempotency_authenticated_access on patopay.idempotency_keys
  for all to authenticated
  using (actor_id = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid)
  with check (actor_id = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid);

-- Only authenticated Supabase API requests may access the application schema.
revoke all on all tables in schema patopay from public, anon, authenticated;
revoke all on all sequences in schema patopay from public, anon, authenticated;
grant usage on schema patopay to authenticated;
grant select, insert, update on all tables in schema patopay to authenticated;
grant usage, select on all sequences in schema patopay to authenticated;
