\set ON_ERROR_STOP on

-- Usage:
--   psql "$PATOPAY_ADMIN_DATABASE_URL" \
--     -v runtime_password="$PATOPAY_RUNTIME_PASSWORD" \
--     -f supabase/scripts/provision_patopay_runtime.sql
--
-- The password is supplied out-of-band and is never stored in this repository.
\if :{?runtime_password}
alter role patopay_runtime login password :'runtime_password' nosuperuser nocreatedb nocreaterole nobypassrls noreplication;
\else
\echo 'runtime_password is required; refusing to provision a runtime login'
\quit 3
\endif

alter role patopay_runtime set search_path = patopay, public;
