# Backend domain API configuration

Run FastAPI from `backend/`. Real values belong in the ignored `backend/.env`; do not commit database credentials, bearer tokens, relayer credentials, private keys, seed phrases, passkey secrets, or signed authorization payloads.

## Payment backend

The safe local default is the offline mock selector:

```dotenv
PATOPAY_PAYMENT_EXECUTOR=mock
PATOPAY_STELLAR_NETWORK=testnet
PATOPAY_STELLAR_RPC_URL=
PATOPAY_STELLAR_RELAYER_URL=
PATOPAY_STELLAR_ASSET_CONTRACT_ID=
PATOPAY_STELLAR_ASSET_CODE=USDC
PATOPAY_STELLAR_ASSET_SCALE=7
PATOPAY_SUPABASE_TIMEOUT_SECONDS=10
```

`PATOPAY_PAYMENT_EXECUTOR=stellar` is opt-in and requires all of the following:

- an HTTPS/HTTP Stellar RPC URL;
- an HTTPS/HTTP relayer URL;
- a Stellar contract address (`C…`) for the enabled USDC SAC on Testnet;
- an explicitly injected Stellar payment executor in the FastAPI composition root.

Startup fails instead of falling back to mock when the Stellar configuration or adapter is missing. The contract ID is authoritative; `USDC` is display metadata only. Amounts use integer base units with scale 7 and never use floating point as the canonical value.

## Supabase Cloud API

FastAPI no recibe un DSN PostgreSQL ni abre una conexión SQL directa. Usa el
publishable key para llamar al API de Supabase/PostgREST y propaga el JWT del
usuario en las operaciones de dominio. Supabase Cloud administra PostgreSQL,
Auth y RLS; el VPS futuro ejecuta únicamente FastAPI.

Las migrations SQL de `supabase/migrations/` siguen siendo la fuente de verdad
del schema, pero se aplican mediante Supabase CLI al proyecto Cloud. No se debe
ejecutar `supabase start` para conectar el backend al proyecto compartido.

## Self-custody boundary

These settings select infrastructure only. FastAPI does not receive or store wallet private keys, seed phrases, WebAuthn private material, or an unrestricted signer. The client passkey authorizes the smart-wallet invocation, and a relayer only submits an authorization already bound to a persisted payment intent.
