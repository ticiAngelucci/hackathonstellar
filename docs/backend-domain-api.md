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
PATOPAY_DATABASE_SSLMODE=require
```

`PATOPAY_PAYMENT_EXECUTOR=stellar` is opt-in and requires all of the following:

- an HTTPS/HTTP Stellar RPC URL;
- an HTTPS/HTTP relayer URL;
- a Stellar contract address (`C…`) for the enabled USDC SAC on Testnet;
- an explicitly injected Stellar payment executor in the FastAPI composition root.

Startup fails instead of falling back to mock when the Stellar configuration or adapter is missing. The contract ID is authoritative; `USDC` is display metadata only. Amounts use integer base units with scale 7 and never use floating point as the canonical value.

## PostgreSQL

`PATOPAY_DATABASE_URL` is server-only and is redacted by the settings representation. `PATOPAY_DATABASE_SSLMODE=require` is the remote default; disposable local PostgreSQL may explicitly use `disable`. Supabase Cloud remains hosted by Supabase; a future VPS runs only FastAPI.

## Self-custody boundary

These settings select infrastructure only. FastAPI does not receive or store wallet private keys, seed phrases, WebAuthn private material, or an unrestricted signer. The client passkey authorizes the smart-wallet invocation, and a relayer only submits an authorization already bound to a persisted payment intent.
