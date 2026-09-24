# Plan de implementación: fases 5–9 de PatoPay

## Goal

Implementar autenticación JWT de Supabase, perfiles, eventos persistentes, wallets/assets, policies versionadas y PaymentRequests con evaluación determinista, usando exclusivamente Supabase Cloud Auth/PostgREST/RPC desde FastAPI y manteniendo la autocustodia Stellar.

## Current context / assumptions

- Repositorio: `/home/jhaycortez/code/f-projects/f-pato_pay`.
- Backend: `/home/jhaycortez/code/f-projects/f-pato_pay/backend`.
- Rama actual: `main`, sincronizada con `origin/main`.
- Commit de base observado: `ef0bdb6a Implementación de las primeras 5 fases del backend`.
- Worktree observado limpio.
- Fases 0–4 implementadas:
  - configuración y composition root;
  - dominio puro de dinero, policies y estados;
  - migrations privadas/RLS para Supabase;
  - cliente HTTP Supabase/PostgREST y `SupabaseTableGateway`.
- El runtime Python **no** debe volver a incorporar:
  - `sqlalchemy`;
  - `psycopg`;
  - `PATOPAY_DATABASE_URL`;
  - Session Pooler/DSN;
  - `service_role`.
- Supabase Cloud Free administra PostgreSQL/Auth. FastAPI accede mediante HTTPS a Supabase/PostgREST, propagando el JWT del usuario.
- `supabase/config.toml` expone `patopay` a PostgREST y las policies nuevas autorizan a `authenticated`.
- El cliente actual está en:
  - `backend/src/patopay/infrastructure/supabase/client.py`;
  - `backend/src/patopay/infrastructure/supabase/gateway.py`.
- El gateway actual ofrece `select`, `insert`, `update` y `rpc`, pero todavía no agrega automáticamente los headers de schema `patopay`. Fase 5 debe cerrarlo antes de construir casos de uso.
- La API actual sólo tiene:
  - `GET /health`;
  - `GET /ready`;
  - `POST /api/v1/events` en memoria;
  - `GET /api/v1/events` en memoria.
- El frontend todavía usa:
  - `frontend/src/services/supabaseAuth.ts` con sesión anónima para el relayer;
  - `frontend/src/services/supabaseClient.ts` y `appDataService.ts` contra PostgREST directo;
  - `EXPO_PUBLIC_PATOPAY_USER_ID` como identidad simulada;
  - `frontend/src/services/eventService.ts` con PostgREST directo.
- No se deben cortar esos consumidores frontend durante estas cinco fases; el cutover completo pertenece a la fase 13.
- `backend/.env.example` y `frontend/.env.example` tienen cambios locales protegidos. No editarlos ni stagearlos sin autorización explícita.
- Las pruebas normales no llaman Supabase Cloud. Usan claves efímeras, `httpx.MockTransport` y gateways fake controlados por tests.
- Las pruebas de migrations/RLS contra Supabase CLI son un gate aparte. Antes de ejecutarlas remotamente hay que autenticar, enlazar, listar migrations y ejecutar `db push --dry-run`. Nunca usar `migration repair`, `db reset --linked` ni `--include-seed` sobre Cloud.

## Architecture / proposed approach

Mantener `API → Application → Domain → Infrastructure`, con FastAPI derivando el actor exclusivamente de un JWT Supabase verificado y con los casos de uso llamando a puertos HTTP de Supabase. Las lecturas simples usarán PostgREST con `Accept-Profile: patopay`/`Content-Profile: patopay`; todas las escrituras multi-row que necesiten atomicidad, idempotencia o control de concurrencia se implementarán como funciones RPC SQL bajo `supabase/migrations/` y se invocarán mediante el gateway, nunca simulando una Unit of Work Python. El cliente móvil seguirá usando Supabase Auth para obtener su sesión, pero los datos de dominio nuevos pasarán progresivamente por FastAPI.

## Reglas transversales para cada tarea

Cada tarea de código sigue este ciclo, en este orden:

1. Crear un único test focalizado.
2. Ejecutar el test exacto y verificar RED por comportamiento ausente.
3. Implementar lo mínimo.
4. Ejecutar el test exacto y verificar GREEN.
5. Ejecutar el archivo/suite relevante.
6. Refactorizar sólo en verde: eliminar imports muertos, placeholders, broad catches y logs sensibles.
7. Ejecutar el gate de la fase.
8. Revisar `git diff --check`.
9. Crear un commit pequeño y específico.

Comando base del backend:

```bash
cd /home/jhaycortez/code/f-projects/f-pato_pay/backend
```

Gate común:

```bash
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
uv run mypy src
```

Salida esperada del gate común cuando todo esté verde:

```text
46+ passed
All checks passed!
< N > files already formatted
Success: no issues found in < N > source files
```

Los números exactos pueden crecer con cada fase; no escribirlos a mano en assertions ni documentación.

---

# Fase 5 — JWT Supabase y perfil actual

## Objetivo

Aceptar únicamente JWT Supabase válidos, rechazar sesiones anónimas en rutas de dominio y exponer `/api/v1/me` con un perfil ligado a `auth.users.id = JWT.sub`.

## Contrato final de esta fase

```text
GET   /api/v1/me
PUT   /api/v1/me
PATCH /api/v1/me
GET   /api/v1/profiles?username=<exact>
```

El body nunca define el actor. `id`, email, role y claims de autorización no son editables por el cliente.

### Tarea 5.1 — Fijar schema PostgREST en el gateway

**Archivos:**

- Modificar `backend/src/patopay/infrastructure/supabase/client.py`.
- Modificar `backend/src/patopay/infrastructure/supabase/gateway.py`.
- Modificar `backend/tests/test_supabase_client.py`.

**RED:** agregar un test que capture un `GET /rest/v1/profiles` y exija:

```text
Accept-Profile: patopay
Authorization: Bearer user-jwt
apikey: publishable-test-key
```

Comando:

```bash
uv run pytest tests/test_supabase_client.py::test_gateway_sends_patopay_profile_headers -q
```

Esperado en RED:

```text
FAILED ... header 'accept-profile' is missing
```

**GREEN:** agregar un parámetro privado `schema: str = "patopay"` al gateway y usar:

```python
schema_headers = {
    "Accept-Profile": schema,
    "Content-Profile": schema,
}
```

Para `GET`, enviar sólo `Accept-Profile`; para `POST/PATCH/DELETE/RPC`, enviar `Content-Profile`. No aceptar nombres de schema provenientes del request HTTP; el caso de uso usa el valor constante `patopay`.

Ejecutar:

```bash
uv run pytest tests/test_supabase_client.py -q
```

Esperado:

```text
.... passed
```

Commit:

```bash
git add backend/src/patopay/infrastructure/supabase backend/tests/test_supabase_client.py
git diff --cached --check
git commit -m "test: bind PostgREST gateway to patopay schema"
```

### Tarea 5.2 — Definir claims y errores de autenticación

**Archivos:**

- Crear `backend/src/patopay/application/ports/auth.py` si el puerto actual no alcanza.
- Crear `backend/src/patopay/api/errors.py`.
- Crear `backend/tests/unit/infrastructure/test_supabase_jwt.py`.

**RED:** escribir tests para:

- `sub` ausente o no UUID;
- `role != authenticated`;
- `aud != authenticated`;
- `iss != Settings.supabase_issuer`;
- `exp` vencido;
- `alg` fuera de `RS256|ES256`;
- token anónimo rechazado;
- errores sin token completo en `str(exc)`.

Usar una clave RSA/EC efímera generada dentro del test. Nunca incluir un JWT literal real.

Comando RED:

```bash
uv run pytest tests/unit/infrastructure/test_supabase_jwt.py::test_anonymous_claims_are_rejected -q
```

Esperado:

```text
FAILED ... ModuleNotFoundError ... supabase_jwt
```

**GREEN:** definir estos tipos mínimos:

```python
from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True, slots=True)
class AuthenticatedActor:
    subject: UUID
    role: str
    email: str | None = None
```

Los errores públicos sólo pueden exponer códigos como `invalid_token`, `anonymous_session` o `jwks_unavailable`; nunca bearer token, JWKS body ni claims completos.

**REFACTOR:** centralizar reason codes en `backend/src/patopay/api/errors.py` y no repetir `HTTPException` construidas en cada route.

Gate focalizado:

```bash
uv run pytest tests/unit/infrastructure/test_supabase_jwt.py -q
```

### Tarea 5.3 — Implementar verificador JWKS con refresh controlado

**Archivos:**

- Crear `backend/src/patopay/infrastructure/auth/supabase_jwt.py`.
- Crear `backend/tests/unit/infrastructure/test_supabase_jwt.py` o extenderlo.

**Contrato:**

```python
class SupabaseJwtVerifier:
    async def verify(self, token: str) -> AuthenticatedActor: ...
```

Implementación obligatoria:

1. Leer el header JWT sin confiar todavía en claims.
2. Permitir sólo `RS256` y `ES256`.
3. Buscar la clave por `kid` en `https://<project>.supabase.co/auth/v1/.well-known/jwks.json`.
4. Cachear JWKS por TTL configurable.
5. Si aparece un `kid` desconocido, refrescar una vez y reintentar una sola vez.
6. Validar firma, `iss`, `aud="authenticated"`, `exp`, `sub` UUID y `role="authenticated"`.
7. Rechazar `role="anon"` o cualquier sesión anónima.
8. No permitir HS256 ni leer un JWT secret legacy.
9. Mapear timeout, JSON inválido, firma inválida y claims inválidos a `InvalidTokenError` seguro.

El decoder debe usar una configuración equivalente a:

```python
jwt.decode(
    token,
    key,
    algorithms=["RS256", "ES256"],
    audience="authenticated",
    issuer=settings.supabase_issuer,
    options={"require": ["exp", "sub", "aud", "iss"]},
)
```

No llamar Supabase Cloud en pytest: usar `httpx.MockTransport` para JWKS.

Tests RED → GREEN mínimos:

```bash
uv run pytest tests/unit/infrastructure/test_supabase_jwt.py::test_unknown_kid_refreshes_jwks_once -q
uv run pytest tests/unit/infrastructure/test_supabase_jwt.py -q
```

Esperado: primero `F` por ausencia del refresh; después todos `passed`.

Commit:

```bash
git add backend/src/patopay/infrastructure/auth backend/tests/unit/infrastructure/test_supabase_jwt.py
git diff --cached --check
git commit -m "feat: verify Supabase JWTs through JWKS"
```

### Tarea 5.4 — Dependency FastAPI para bearer y actor

**Archivos:**

- Crear/modificar `backend/src/patopay/api/dependencies.py`.
- Crear `backend/tests/api/test_auth.py`.

**Contrato exacto:**

```python
async def get_current_actor(request: Request) -> AuthenticatedActor: ...
```

Comportamiento:

- header ausente → `401`;
- esquema distinto de `Bearer <token>` → `401`;
- token inválido → `401`;
- token anónimo → `401`;
- token válido → actor desde `sub`.

La dependency debe obtener el verificador desde `request.app.state.auth_verifier`. No crear un cliente global oculto ni leer variables globales dentro de routes.

RED:

```bash
uv run pytest tests/api/test_auth.py::test_protected_route_without_bearer_returns_401 -q
```

GREEN: crear una route temporal de test dentro de `tests/api/test_auth.py` con `APIRouter`, no una route de producción, y probar la dependency con un verifier fake.

Luego aplicar la dependency a `/api/v1/me` cuando exista la route de perfil.

### Tarea 5.5 — Profile use case y schemas

**Archivos:**

- Crear `backend/src/patopay/application/use_cases/profiles.py`.
- Crear `backend/src/patopay/api/schemas/profiles.py`.
- Crear `backend/tests/api/test_profile_api.py`.

Schemas exactos:

```python
class ProfileUpdate(ApiModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    username: str | None = Field(default=None, min_length=3, max_length=40, pattern=r"^[a-z0-9_]+$")
    notifications_enabled: bool | None = None


class ProfileResponse(ApiModel):
    id: UUID
    username: str | None
    display_name: str | None
    notifications_enabled: bool
```

El use case debe:

- filtrar siempre `id=eq.<actor.subject>`;
- enviar `id` sólo en create/upsert controlado por el actor;
- seleccionar únicamente `id,username,display_name,notifications_enabled`;
- nunca devolver email, raw metadata, role ni JWT claims;
- convertir `409` de username único a error de dominio/API;
- usar el gateway con `access_token` del request, nunca `service_role`.

### Tarea 5.6 — Routes `/me` y lookup público mínimo

**Archivos:**

- Crear `backend/src/patopay/api/routes/profiles.py`.
- Modificar `backend/src/patopay/api/router.py`.
- Crear/modificar `backend/tests/api/test_profile_api.py`.

Routes:

```text
GET   /api/v1/me
PUT   /api/v1/me
PATCH /api/v1/me
GET   /api/v1/profiles?username=<exact>
```

`GET /profiles` sólo devuelve datos mínimos y exige JWT válido. El lookup debe usar filtro PostgREST exacto, no `ilike`, substring ni retornar múltiples usuarios.

Tests RED → GREEN:

```bash
uv run pytest tests/api/test_profile_api.py::test_me_derives_profile_id_from_jwt -q
uv run pytest tests/api/test_profile_api.py -q
```

Agregar OpenAPI assertion de bearer y routes.

### Tarea 5.7 — Gate y commit de Fase 5

```bash
uv run pytest tests/unit/infrastructure/test_supabase_jwt.py tests/api/test_auth.py tests/api/test_profile_api.py -q
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
uv run mypy src
git diff --check
```

Gate remoto opcional, sólo con CLI autenticado y sin imprimir tokens:

```bash
npx supabase migration list
npx supabase db push --dry-run
```

Commit:

```bash
git add backend/src/patopay backend/tests docs/backend-domain-api.md
git diff --cached --check
git commit -m "feat: authenticate API users with Supabase JWT"
```

---

# Fase 6 — Eventos autenticados y persistentes

## Objetivo

Eliminar el actor enviado en el body, persistir eventos en `patopay.events`/`patopay.event_participants` y garantizar visibilidad por RLS Supabase.

### Tarea 6.1 — RLS de participantes para owner y miembros

**Archivos:**

- Crear `supabase/migrations/20260922100000_harden_event_visibility.sql`.
- Crear `supabase/tests/database/004_event_visibility.test.sql`.

La policy de lectura de `event_participants` debe permitir ver participantes si el actor:

```sql
user_id = auth.uid()
OR exists (
  select 1 from patopay.events e
  where e.id = event_id
    and (
      e.owner_id = auth.uid()
      or exists (
        select 1 from patopay.event_participants ep
        where ep.event_id = e.id and ep.user_id = auth.uid()
      )
    )
)
```

La policy de insert sólo permite al owner agregar participantes o al actor agregarse a sí mismo según el flujo elegido. Para esta fase, `create_event` agrega únicamente al owner y el alta de miembros queda diferida.

RED SQL: `004_event_visibility.test.sql` falla porque la policy actual sólo deja leer la propia fila de participante.

No ejecutar contra Cloud hasta:

```bash
npx supabase login
npx supabase link --project-ref "$PATOPAY_SUPABASE_PROJECT_REF"
npx supabase db push --dry-run
```

### Tarea 6.2 — RPC atómico de creación

**Archivos:**

- Crear `supabase/migrations/20260922100100_create_event_rpc.sql`.
- Crear `supabase/tests/database/005_event_rpc.test.sql`.

Usar esta función como contrato base, adaptando tipos si el parser local lo exige:

```sql
create or replace function patopay.create_event_with_owner(p_name text)
returns patopay.events
language plpgsql
security invoker
set search_path = patopay, public
as $$
declare
  v_actor uuid := auth.uid();
  v_event patopay.events;
begin
  if v_actor is null then
    raise exception 'authenticated actor required' using errcode = '28000';
  end if;

  insert into patopay.events (owner_id, name)
  values (v_actor, p_name)
  returning * into v_event;

  insert into patopay.event_participants (event_id, user_id, role)
  values (v_event.id, v_actor, 'owner');

  return v_event;
end;
$$;

grant execute on function patopay.create_event_with_owner(text) to authenticated;
```

No aceptar `owner_id` desde PostgREST. La función lo obtiene de `auth.uid()`.

### Tarea 6.3 — Event gateway/use case

**Archivos:**

- Crear `backend/src/patopay/application/use_cases/events.py`.
- Crear `backend/src/patopay/api/schemas/events.py`.
- Modificar `backend/src/patopay/api/routes/events.py`.
- Modificar `backend/src/patopay/api/dependencies.py` si hace falta `get_supabase_gateway`.
- Crear `backend/tests/api/test_events_api.py`.
- Crear `backend/tests/unit/application/test_events.py`.

Contrato HTTP:

```text
POST /api/v1/events       body: {"name": "..."}
GET  /api/v1/events
GET  /api/v1/events/{event_id}
```

El body `creator` debe producir `422` por `extra="forbid"`. El use case:

- toma actor y JWT de dependencies;
- llama RPC `create_event_with_owner`;
- lista eventos mediante PostgREST con filtros/RLS;
- agrega participantes sin exponer usuarios fuera de la visibilidad del actor;
- mapea `PGRST`/HTTP errors a errores API seguros.

RED focalizado:

```bash
uv run pytest tests/api/test_events_api.py::test_create_event_rejects_creator_from_body -q
```

Esperado: `F` mientras el schema viejo todavía acepta `creator`.

GREEN y regresión:

```bash
uv run pytest tests/api/test_events_api.py -q
uv run pytest -q
```

Eliminar `InMemoryEventService` sólo después de que las tests API pasen y el composition root inyecte el use case/gateway real. No dejar fallback de producción en memoria.

### Tarea 6.4 — Persistencia HTTP y errores

**Archivos:**

- Crear `backend/src/patopay/infrastructure/supabase/event_repository.py` sólo si el use case necesita separar mapping.
- Crear `backend/tests/unit/infrastructure/test_event_repository.py`.

Testear con `httpx.MockTransport`:

- schema header `patopay`;
- JWT bearer;
- RPC path `/rest/v1/rpc/create_event_with_owner`;
- respuesta 401/403/409 mapeada sin filtrar body completo;
- JSON inválido rechazado.

### Tarea 6.5 — Gate y commit de Fase 6

```bash
uv run pytest tests/unit/application/test_events.py tests/unit/infrastructure/test_event_repository.py tests/api/test_events_api.py -q
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
uv run mypy src
git grep -n 'InMemoryEventService\|ParticipantInput\|creator' -- backend/src backend/tests || true
```

Esperado: no queda route de producción en memoria ni actor en body.

Commit:

```bash
git add backend/src backend/tests supabase/migrations supabase/tests/database
git diff --cached --check
git commit -m "feat: persist authenticated events through Supabase"
```

---

# Fase 7 — Asset USDC, wallets y balance por adapter

## Objetivo

Registrar metadata pública de wallets, habilitar sólo el asset USDC Testnet configurado y leer balances mediante adapters sin afirmar ownership ni custodiar secretos.

### Tarea 7.1 — Contratos de asset/wallet y amount minor

**Archivos:**

- Crear `backend/src/patopay/application/ports/wallets.py`.
- Crear `backend/src/patopay/application/use_cases/wallets.py`.
- Crear `backend/src/patopay/api/schemas/wallets.py`.
- Crear `backend/tests/unit/application/test_wallets.py`.
- Crear `backend/tests/unit/application/test_assets.py`.

Contratos:

```python
class WalletBalanceGateway(Protocol):
    async def get_balance_minor(self, wallet: WalletBinding) -> int: ...
```

`WalletResponse` sólo puede contener:

```text
id, provider, network, contract_address, status, is_default, version,
wallet_wasm_hash, creation_tx_hash
```

Nunca incluir credential ID privado, seed, private key, passkey secret, JWT, XDR o balance como fuente autoritativa.

RED focalizado:

```bash
uv run pytest tests/unit/application/test_wallets.py::test_wallet_registration_never_accepts_private_material -q
```

El schema debe usar `extra="forbid"` y rechazar campos como `private_key`, `seed_phrase`, `secret` y `signed_xdr`.

### Tarea 7.2 — Asset registry por contract ID

**Archivos:**

- Crear `backend/src/patopay/application/use_cases/assets.py`.
- Crear `backend/tests/unit/application/test_assets.py`.

Reglas:

- network obligatorio `testnet`;
- code `USDC` sólo display metadata;
- contract ID con forma `C[A-Z2-7]{55}`;
- decimals/scale vienen del registro, no del ticker;
- asset disabled o contract ID ausente → error explícito;
- no fallback silencioso a XLM.

El `GET /me/wallets/.../balance` debe resolver el asset registry antes de llamar al adapter.

### Tarea 7.3 — Routes de wallets

**Archivos:**

- Crear `backend/src/patopay/api/routes/wallets.py`.
- Modificar `backend/src/patopay/api/router.py`.
- Crear `backend/tests/api/test_wallet_api.py`.

Routes:

```text
POST   /api/v1/me/wallets
GET    /api/v1/me/wallets
GET    /api/v1/me/wallets/{wallet_id}
DELETE /api/v1/me/wallets/{wallet_id}
GET    /api/v1/me/wallets/{wallet_id}/balance
```

Semántica:

- owner siempre `auth.uid()`/JWT subject;
- POST sólo registra metadata creada por cliente;
- wallet nueva queda `unverified`;
- DELETE cambia `status=disabled`, no borra historia;
- `expected_version` obligatorio para cambiar default/estado concurrentemente;
- user B recibe `404`, no filtración de existencia.

### Tarea 7.4 — Adapters mock y Stellar balance

**Archivos:**

- Crear `backend/src/patopay/infrastructure/payments/mock_wallet.py`.
- Crear `backend/src/patopay/infrastructure/payments/stellar_balance.py`.
- Crear `backend/tests/unit/infrastructure/payments/test_mock_wallet_gateway.py`.
- Crear `backend/tests/unit/infrastructure/payments/test_stellar_balance_gateway.py`.

Mock:

```json
{"amount_minor":"100000000","asset_id":"...","observed_at":"...","mode":"mock"}
```

Stellar:

- usar `httpx.MockTransport`;
- parsear respuesta RPC/Horizon sólo para balance observado;
- devolver timeout/error tipado;
- nunca persistir balance como fuente de verdad;
- guardar `observed_at` y ledger si la tabla/modelo lo permite.

### Tarea 7.5 — Persistencia PostgREST y restricciones

**Archivos:**

- Crear `backend/src/patopay/infrastructure/supabase/wallet_repository.py` si el mapping deja de ser trivial.
- Crear `backend/tests/unit/infrastructure/test_wallet_repository.py`.
- Crear `supabase/tests/database/006_wallet_rls.test.sql`.

Probar que el gateway usa filtros `user_id=eq.<actor>` y headers de schema. La protección real debe quedar en RLS, no sólo en el filtro Python.

El asset USDC Testnet real debe configurarse por entorno/seed aprobado. No inventar el contract ID en una migration ni en un test que se presente como smoke real.

### Tarea 7.6 — Gate y commit de Fase 7

```bash
uv run pytest tests/unit/application/test_wallets.py tests/unit/application/test_assets.py \
  tests/api/test_wallet_api.py tests/unit/infrastructure/payments -q
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
uv run mypy src
```

Commit:

```bash
git add backend/src backend/tests supabase/tests/database
 git diff --cached --check
git commit -m "feat: manage wallets and USDC asset metadata"
```

---

# Fase 8 — Policy versions, allowlists y service subscriptions

## Objetivo

Exponer policies completas y versionadas por actor, con allowlists y subscriptions persistidas en Supabase, sin mutar una versión usada por un PaymentRequest.

### Tarea 8.1 — Schemas de policy sin floats

**Archivos:**

- Crear `backend/src/patopay/api/schemas/policies.py`.
- Crear `backend/src/patopay/api/schemas/service_subscriptions.py`.
- Crear `backend/tests/unit/application/test_policies.py`.

Payload de policy:

```json
{
  "auto_pay_limit_minor": "50000000",
  "approval_limit_minor": "300000000",
  "daily_limit_minor": "500000000",
  "recipient_mode": "allowlist",
  "allowed_recipient_ids": ["uuid"],
  "allowed_asset_ids": ["uuid"],
  "expected_version": 1
}
```

Validar:

- strings decimales canónicas;
- límites `0 <= auto <= approval <= MAX_AMOUNT_MINOR`;
- daily `> 0`;
- asset allowlist no vacía;
- no floats, exponentes, signos, `bool` ni `number` JS;
- no recipient igual al actor;
- IDs UUID válidos.

RED:

```bash
uv run pytest tests/unit/application/test_policies.py::test_policy_rejects_float_limits -q
```

### Tarea 8.2 — RPC atómico de nueva policy version

**Archivos:**

- Crear `supabase/migrations/20260922110000_create_policy_version_rpc.sql`.
- Crear `supabase/tests/database/007_policy_version_rpc.test.sql`.

La función `patopay.replace_payment_policy(...)` debe:

1. leer `auth.uid()`;
2. bloquear/validar la última versión del actor;
3. comprobar `expected_version`;
4. insertar nueva fila inmutable en `payment_policy_versions`;
5. insertar allowlisted recipients/assets;
6. rechazar assets disabled/desconocidos;
7. rechazar self-recipient;
8. devolver la versión nueva;
9. no actualizar/borrar versiones previas.

La RPC debe ser `security invoker`, ejecutable sólo por `authenticated` y con `search_path` fijado.

### Tarea 8.3 — Use case y routes de policy

**Archivos:**

- Crear `backend/src/patopay/application/use_cases/policies.py`.
- Crear `backend/src/patopay/api/routes/policies.py`.
- Crear `backend/tests/api/test_policy_api.py`.

Routes:

```text
GET /api/v1/me/payment-policy
PUT /api/v1/me/payment-policy
GET /api/v1/me/payment-policy/allowed-recipients
PUT /api/v1/me/payment-policy/allowed-recipients/{profile_id}
DELETE /api/v1/me/payment-policy/allowed-recipients/{profile_id}
```

`GET` debe crear/defaultizar una policy segura una sola vez mediante RPC o devolver la vigente. `PUT` siempre crea una versión nueva. `expected_version` desactualizado → `409`.

El route no evalúa reglas: llama al use case, que transforma los valores a `PaymentPolicy` del dominio y usa el gateway/RPC.

### Tarea 8.4 — Service subscriptions

**Archivos:**

- Crear `backend/src/patopay/application/use_cases/service_subscriptions.py`.
- Crear `backend/src/patopay/api/routes/service_subscriptions.py`.
- Crear `backend/tests/api/test_service_subscriptions_api.py`.

Sólo permitir service IDs de un registry explícito en código/config. Nunca aceptar una URL o función arbitraria desde el cliente. Usar upsert PostgREST con filtro/actor derivado del JWT y response representation.

### Tarea 8.5 — Gate y commit de Fase 8

```bash
uv run pytest tests/unit/application/test_policies.py \
  tests/api/test_policy_api.py tests/api/test_service_subscriptions_api.py -q
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
uv run mypy src
```

Validación SQL sólo tras CLI autenticado:

```bash
npx supabase db push --dry-run
npx supabase test db
```

Commit:

```bash
git add backend/src backend/tests supabase/migrations supabase/tests/database
 git diff --cached --check
git commit -m "feat: persist versioned payment policies"
```

---

# Fase 9 — PaymentRequest y evaluación/persistencia de decisión

## Objetivo

Crear PaymentRequests autenticados, evaluar policy de forma determinista y persistir request + decisión inicial atómicamente en Supabase, con idempotencia y sin aceptar identidad/destino económico arbitrarios.

## Contrato HTTP

```text
POST /api/v1/payment-requests
GET  /api/v1/payment-requests
GET  /api/v1/payment-requests/{request_id}
```

Payload permitido:

```json
{
  "payer_profile_id": "uuid",
  "amount_minor": "145000000",
  "asset_id": "uuid",
  "memo": "Asado del viernes"
}
```

No aceptar:

```text
requester_id
recipient_wallet_address
source_wallet_id
status
policy_outcome
tx_hash
```

El requester y la wallet destino se derivan del JWT/perfil/wallet activo. El payer debe ser distinto al requester.

### Tarea 9.1 — Schemas, idempotency key y errores de conflicto

**Archivos:**

- Crear `backend/src/patopay/api/schemas/payment_requests.py`.
- Modificar `backend/src/patopay/api/errors.py`.
- Crear `backend/tests/unit/application/test_create_payment_request.py`.

Validar header obligatorio:

```text
Idempotency-Key: <1..128 caracteres>
```

Calcular hash canónico del payload permitido, nunca del JWT completo. Rechazar misma key con payload distinto como `409 idempotency_conflict`.

RED focalizado:

```bash
uv run pytest tests/unit/application/test_create_payment_request.py::test_payment_request_rejects_missing_idempotency_key -q
```

### Tarea 9.2 — Policy evaluator application service

**Archivos:**

- Crear `backend/src/patopay/application/services/policy_evaluator.py`.
- Crear `backend/tests/unit/application/test_create_payment_request.py`.

El servicio debe adaptar los datos persistidos al dominio `PaymentPolicy.evaluate` y devolver:

```python
@dataclass(frozen=True, slots=True)
class EvaluatedPaymentRequest:
    outcome: str
    reason_code: str
    next_action: str | None
    policy_snapshot: tuple[tuple[str, str], ...]
```

Matriz obligatoria:

| Condición | outcome | reason | next action |
|---|---|---|---|
| recipient no permitido | `blocked` | `recipient_not_allowed` | `None` |
| asset no permitido | `blocked` | `asset_not_allowed` | `None` |
| daily excedido | `blocked` | `daily_limit_exceeded` | `None` |
| `amount <= auto_pay_limit` | `eligible_for_auto_approval` | `within_auto_pay_limit` | `prepare_sign_and_execute` |
| `amount <= approval_limit` | `approval_required` | `manual_approval_required` | `approve_or_reject` |
| sobre approval | `blocked` | `approval_limit_exceeded` | `None` |

`eligible_for_auto_approval` nunca equivale a `paid` ni evita la firma local futura.

### Tarea 9.3 — RPC transaccional de creación

**Archivos:**

- Crear `supabase/migrations/20260922120000_create_payment_request_rpc.sql`.
- Crear `supabase/tests/database/008_payment_request_rpc.test.sql`.

La RPC `patopay.create_payment_request(...)` debe:

1. obtener `v_requester := auth.uid()`;
2. validar payer distinto;
3. resolver perfiles/wallets activos;
4. verificar asset enabled y contrato exacto;
5. cargar policy vigente;
6. comprobar gasto confirmado del día UTC;
7. insertar `payment_requests` con snapshot inmutable;
8. insertar `policy_decisions` inicial;
9. guardar idempotency key + request hash;
10. devolver request, outcome, reason y next action;
11. devolver replay original si key/hash coinciden;
12. devolver conflicto si la key coincide pero hash cambia.

La función debe usar `auth.uid()`, no aceptar requester como argumento y no guardar JWT/XDR/private material.

La evaluación Python de 9.2 sirve como regla pura y contrato de tests; la RPC es la barrera de atomicidad/concurrencia. Añadir un test de paridad para que los reason codes sean iguales.

### Tarea 9.4 — Use case y routes

**Archivos:**

- Crear `backend/src/patopay/application/use_cases/payment_requests.py`.
- Crear `backend/src/patopay/api/routes/payment_requests.py`.
- Modificar `backend/src/patopay/api/router.py`.
- Crear `backend/tests/api/test_payment_requests_api.py`.

Implementar:

- `POST` llama RPC con JWT e idempotency key;
- `GET` usa filtros PostgREST/RLS y devuelve sólo requests donde actor es requester/payer;
- `direction=incoming|outgoing` se transforma en filtros application-controlled;
- `GET /{id}` devuelve `404` cuando el actor no es parte o el registro no es visible;
- mapear RPC conflict/validation a `409`/`422` sin exponer SQL detail.

Response inicial:

```json
{
  "id": "uuid",
  "status": "approved|pending_approval|blocked",
  "policy_outcome": "eligible_for_auto_approval|approval_required|blocked",
  "reason_code": "within_auto_pay_limit",
  "next_action": "prepare_sign_and_execute",
  "amount_minor": "145000000",
  "asset_id": "uuid"
}
```

No devolver `paid`, `tx_hash`, `explorer_url` ni un hash sintético.

### Tarea 9.5 — Concurrencia e idempotencia

**Archivos:**

- Crear `backend/tests/unit/application/test_create_payment_request.py` para replay/hash conflict.
- Crear `backend/tests/api/test_payment_requests_api.py` para responses.
- Crear `supabase/tests/database/009_payment_request_concurrency.test.sql` o ampliar `008`.

Casos:

- dos POST concurrentes con misma key + mismo payload → un request y mismo response;
- misma key + payload distinto → un `409`;
- dos requests distintos que cruzan el daily limit → la RPC no puede permitir ambos si el total confirmado supera el límite;
- request de user B no aparece para user A;
- no hay actor/body spoof.

En tests HTTP usar `httpx.MockTransport`; la carrera real sólo se valida con `supabase test db`/entorno PostgreSQL de Supabase, nunca con un fake Python.

### Tarea 9.6 — Gate y commit de Fase 9

```bash
uv run pytest tests/unit/application/test_create_payment_request.py \
  tests/api/test_payment_requests_api.py -q
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
uv run mypy src
```

Gate Supabase, sólo después de `migration list` y `db push --dry-run` aprobados:

```bash
npx supabase test db
```

Commit:

```bash
git add backend/src backend/tests supabase/migrations supabase/tests/database
 git diff --cached --check
git commit -m "feat: create policy-evaluated payment requests"
```

Aceptación: cada PaymentRequest tiene una decisión inicial y snapshot de policy; ninguna ruta confunde aprobación/elegibilidad con settlement.

---

## Tests / validation — resumen de la secuencia completa

### Antes de comenzar

```bash
cd /home/jhaycortez/code/f-projects/f-pato_pay
 git status --short --branch
cd backend
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
uv run mypy src
```

Esperado: worktree limpio al inicio, suite actual verde, Ruff/formatter/mypy verdes.

### Por cada fase

- RED focalizado con `uv run pytest path::test -q` y fallo por comportamiento faltante.
- GREEN focalizado con `.`.
- Suite completa `uv run pytest -q`.
- Ruff, formatter y mypy.
- `git diff --check`.
- Commit específico.

### Validación Supabase Cloud

No aplicar cambios remotos automáticamente. El operador debe ejecutar desde la raíz, de forma interactiva:

```bash
npx supabase login
npx supabase link --project-ref "$PATOPAY_SUPABASE_PROJECT_REF"
npx supabase migration list
npx supabase db push --dry-run
```

Revisar que:

- el target sea `ekgfskibieqljhazchno`;
- `patopay` esté expuesto en la API;
- `anon` no tenga grants/policies de dominio;
- `authenticated` sí tenga grants explícitos y RLS;
- las migrations legacy sólo estén bloqueadas, no borradas prematuramente.

Luego, sólo con aprobación:

```bash
npx supabase db push
npx supabase test db
```

Leer de vuelta:

```bash
npx supabase migration list
```

Nunca incluir access token, database password, JWT, `service_role` ni contenido de `.env` en commits, logs o respuestas.

## Risks, tradeoffs, and open questions

### Riesgos

- **RPC SQL vs múltiples requests PostgREST:** dos requests HTTP no son una transacción; toda escritura multi-row crítica debe ser RPC.
- **Schema PostgREST:** `patopay` requiere `Accept-Profile`/`Content-Profile`, grants `authenticated` y configuración API consistente. Un error aquí puede devolver `404` aunque la tabla exista.
- **RLS recursiva:** policies que consultan tablas con RLS pueden generar recursion o visibilidad incompleta. Probar owner, member, user B y anon con el rol real `authenticated`.
- **JWT remoto legacy:** si Supabase Cloud no publica JWKS asimétrico, no copiar un secret HS256 al backend. Detener rollout autenticado y abrir una decisión explícita.
- **Identidad frontend simulada:** `EXPO_PUBLIC_PATOPAY_USER_ID` y sesión anónima no pueden usarse en rutas de dominio después de la fase 5.
- **Contract ID USDC:** no inventar ni fijar un contrato no verificado. La fase 7 puede quedar bloqueada para smoke real hasta tener el SAC contract ID Testnet confirmado.
- **PostgREST response shapes:** `insert/update/rpc` pueden devolver objeto, lista o respuesta vacía según `Prefer`; cada gateway debe validar shape antes de mapear dominio.
- **Idempotencia remota:** debe vivir en Supabase/RPC, no sólo en memoria del proceso FastAPI.

### Tradeoffs

- Se acepta una capa RPC SQL en Supabase para atomicidad, aunque FastAPI no use SQL directo.
- Las tests normales mockean HTTP para ser rápidas y deterministas; RLS/concurrencia sólo se consideran verificadas después de tests contra el rol/API Supabase real.
- El frontend puede conservar temporalmente PostgREST directo por compatibilidad, pero ningún dominio nuevo debe agregar otro acceso directo; el cutover completo es la fase 13.
- Los balances observados son caché con timestamp/ledger; Stellar sigue siendo la fuente de verdad.

### Preguntas abiertas que bloquean sólo rollout

1. ¿El proyecto Cloud tiene JWT signing keys asimétricas/JWKS disponibles para `RS256`/`ES256`?
2. ¿Cuál es el contract ID SAC exacto de USDC Testnet que debe habilitarse?
3. ¿Qué service IDs están autorizados para subscriptions?
4. ¿El equipo quiere que `patopay` permanezca expuesto a PostgREST durante todo el cutover o sólo hasta que FastAPI cubra todos los consumers?
5. ¿Qué operador ejecutará `supabase db push` y leerá el estado remoto?

Ninguna de esas preguntas debe bloquear los tests puros de dominio ni los adapters HTTP con `MockTransport`; sí bloquean el smoke Cloud y cualquier despliegue productivo.
