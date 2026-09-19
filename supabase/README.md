# Remote Supabase project

This repository is configured for the hosted Supabase project:

```text
ekgfskibieqljhazchno
https://ekgfskibieqljhazchno.supabase.co
```

This is Supabase Cloud Free. Supabase is not installed or hosted on the VPS;
the VPS, if used, runs only the FastAPI backend and connects to this managed
PostgreSQL/Auth project.

The local CLI project remains named `f-pato_pay`; Supabase stores the remote
link in ignored state under `supabase/.temp/` after authentication.

To complete the CLI link from a developer session:

```bash
npx supabase login
npx supabase link --project-ref ekgfskibieqljhazchno
npx supabase migration list
```

Do not commit access tokens, database passwords, `.env` files, or generated
`supabase/.temp/` state. The hosted project currently has no application
migrations or public tables.
