begin;
set local role postgres;
set local search_path = public, extensions, patopay;
select plan(7);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'patopay'
      and p.proname = 'create_event_with_owner'
  ),
  'event creation RPC exists'
);
select ok(
  exists (
    select 1
    from information_schema.routine_privileges
    where specific_schema = 'patopay'
      and routine_name = 'create_event_with_owner'
      and grantee = 'authenticated'
      and privilege_type = 'EXECUTE'
  ),
  'authenticated can execute event creation RPC'
);
select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'patopay'
      and tablename = 'event_participants'
      and policyname = 'participants_authenticated_access'
      and roles @> array['authenticated']::name[]
  ),
  'participant visibility is scoped to authenticated users'
);
select ok(
  exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'patopay'
      and c.relname = 'events'
      and c.relrowsecurity
      and c.relforcerowsecurity
  ),
  'events keeps forced RLS'
);
select ok(
  exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'patopay'
      and c.relname = 'event_participants'
      and c.relrowsecurity
      and c.relforcerowsecurity
  ),
  'event participants keeps forced RLS'
);
select ok(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'patopay'
      and tablename = 'event_participants'
      and roles @> array['anon']::name[]
  ),
  'anonymous users have no participant policy'
);
select ok(
  (
    select position('auth.uid()' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'patopay' and p.proname = 'create_event_with_owner'
    limit 1
  ),
  'event RPC derives owner from auth.uid'
);

select * from finish();
rollback;
