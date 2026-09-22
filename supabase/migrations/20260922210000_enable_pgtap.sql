-- pgTAP is required by supabase test db and is available on Supabase Cloud.
-- Keep extension objects outside public application schemas.
create extension if not exists pgtap with schema extensions;
