begin;
set local role postgres;
set local search_path = public, extensions, patopay;
select plan(8);

insert into auth.users (id, aud, role, email)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'rls-a@example.invalid'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'rls-b@example.invalid')
on conflict (id) do nothing;

insert into patopay.wallets (user_id, provider, network, contract_address, status)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'mock', 'mock', 'wallet-a', 'active'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'mock', 'mock', 'wallet-b', 'active');

select is(
  (select count(*)::int from patopay.profiles),
  2,
  'auth user trigger creates profiles idempotently'
);

set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
select is((select count(*)::int from patopay.profiles), 1, 'subject A sees only own profile');
select is((select count(*)::int from patopay.wallets), 1, 'subject A sees only own wallet');
select is((select display_name from patopay.profiles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), null, 'subject A cannot read subject B profile');
select is((select count(*)::int from patopay.wallets where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 0, 'subject A cannot read subject B wallet');

update patopay.profiles
set display_name = 'attempted-cross-user-write'
where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

set role postgres;
select is(
  (select display_name from patopay.profiles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  null,
  'cross-user update changes no row'
);

set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
update patopay.profiles set display_name = 'subject-a' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set role postgres;
select is(
  (select display_name from patopay.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'subject-a',
  'subject A can update own profile'
);

select ok(
  (select count(*) = 0 from pg_policies where schemaname = 'patopay' and roles @> array['anon']::name[]),
  'private policies do not grant anon access'
);

select * from finish();
rollback;
