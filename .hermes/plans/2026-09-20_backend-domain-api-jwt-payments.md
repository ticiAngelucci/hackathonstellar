# Plan TDD por fases: FastAPI como frontera de dominio, Auth, políticas y pagos

## Objetivo

Mover el acceso de dominio desde Expo/PostgREST hacia FastAPI y dejar un backend persistente, autenticado y auditable para:

- usuario/perfil actual;
- eventos persistidos (reemplazo del servicio en memoria);
- wallets no custodiales;
- políticas de pago y destinatarios permitidos;
- suscripciones de servicios ya expuestas por la UI;
- solicitudes de pago;
- decisiones de política/manuales append-only;
- transacciones;
- ejecución intercambiable `mock` y Stellar Testnet.

Supabase queda como PostgreSQL + Auth administrados. El frontend conserva Supabase sólo para obtener/refrescar el JWT; los datos de negocio pasan por FastAPI. La wallet Stellar sigue firmando en el dispositivo con passkey: el backend nunca recibe una seed, private key ni credential secret.

## Decisiones alineadas con frontend

Decisiones confirmadas para este plan:

1. **Aprobar y pagar son pasos distintos.** `POST /payment-requests/{id}/approve` registra consentimiento y devuelve `status=approved` + `next_action=prepare_sign_and_execute`. No afirma que hubo movimiento de fondos.
2. **La ejecución requiere passkey local.** FastAPI prepara una intención/operación de corta vida; el dispositivo revisa sus campos, firma las auth entries y entrega la autorización a `POST /payment-requests/{id}/execute`.
3. **El único activo habilitado inicialmente es USDC real de Stellar Testnet**, identificado por `network + SAC contract ID + decimals`; el símbolo `USDC` por sí solo no identifica el activo.
4. **`autoPayLimit` significa elegibilidad para auto-aprobación**, no firma automática. Mientras la passkey requiera presencia, incluso un request auto-aprobado termina en `next_action=prepare_sign_and_execute`.
5. **Mock y Stellar son contratos discriminados.** Mock devuelve `mode=mock`, `status=simulated` y `simulation_id`; nunca inventa `tx_hash`, dirección Stellar ni link al explorer.
6. **`paid` sólo existe tras confirmación on-chain.** Una aceptación del relayer produce `pending`; una lectura verificable de Stellar RPC produce `paid`.

Estas decisiones corrigen una incompatibilidad del pedido inicial: un endpoint de aprobación no puede devolver honestamente `paid + txHash` antes de que la passkey autorice y Stellar confirme. El frontend muestra success definitivo a partir de la respuesta de ejecución/refresh, no de `approve`.

## Alineación de modelos

### User/Profile

`User` es la identidad de Supabase Auth (`auth.users.id`). `Profile` es su extensión de producto:

```text
Profile {
  id                 # igual a JWT sub / auth.users.id
  display_name
  username           # único, normalizado
  notifications_enabled
  created_at
  updated_at
}
```

No incluye `wallet_address` ni `passkey_public_key`: una persona puede tener más de una wallet/credencial y esos ciclos de vida son distintos. La passkey pública ya forma parte de la smart wallet/metadata pública de WebAuthn; FastAPI no la duplica salvo que aparezca un protocolo de verificación concreto.

### Wallet

`Wallet` es una asociación pública; FastAPI no la crea ni la controla:

```text
Wallet {
  id
  user_id
  provider           # stellar | mock
  network            # testnet | mock
  contract_address   # C… para Stellar
  status             # unverified | active | disabled
  wallet_wasm_hash
  creation_tx_hash
  is_default
  created_at
  updated_at
}
```

No guarda balance autoritativo, credential secret, private key, seed phrase ni XDR firmado reutilizable. El balance Stellar se consulta on-chain. En el MVP, el registro inicial puede quedar `unverified`; el control se demuestra en cada ejecución al validar la autorización firmada cuyo `from` coincide. Un challenge criptográfico de asociación queda como hardening previo a Mainnet.

### Asset

```text
Asset {
  id
  network
  contract_address   # SAC contract ID
  code               # USDC, sólo display
  decimals
  enabled
}
```

El contract ID de USDC Testnet se configura y se verifica contra Stellar RPC; no se adivina ni se fija sólo por el ticker.

### Policy

```text
PolicyVersion {
  id
  user_id
  version
  auto_pay_limit_minor
  approval_limit_minor
  daily_limit_minor
  recipient_mode     # any | allowlist
  allowed_recipients
  allowed_assets
  policy_contract_address?  # futuro
  on_chain_revision?        # futuro
}
```

Semántica v1: `<= autoPayLimit` queda aprobado pero aún requiere firma; `<= approvalLimit` requiere aprobación manual; `> approvalLimit` queda bloqueado. `dailyLimit` y allowlists pueden bloquear antes. Cada request guarda la versión/snapshot evaluada para que cambios posteriores no reescriban historia.

### PaymentRequest

Es una intención económica inmutable: requester/payee, payer, wallets resueltas, asset, monto exacto, memo, expiración, resultado de política y estado de decisión. Aprobar no liquida. Las decisiones son append-only.

### Transaction / PaymentAttempt

Cada intento de liquidación es una fila nueva vinculada al request. Guarda estado de envío/confirmación, hash real opcional, referencia del relayer, ledger y error seguro. Permite reconciliar timeouts y reintentar sin mutar un intento histórico.

## Estado observado y baseline

Repositorio real: `/home/jhaycortez/code/f-projects/f-pato_pay`

Componente backend: `/home/jhaycortez/code/f-projects/f-pato_pay/backend`

Rama observada: `main` en `5ce5c4c9`, sincronizada con `origin/main`.

Baseline ejecutada desde `backend/`:

```text
11 tests pasan
ruff check: limpio
ruff format --check: 26 archivos ya formateados
mypy src: limpio sobre 17 source files
```

Estado relevante:

- `API -> Application -> Domain -> Infrastructure` ya está esbozada.
- `POST/GET /api/v1/events` usan `InMemoryEventService`; el creador todavía llega en el body.
- Supabase Cloud/PostgREST y `/ready` existen, pero no hay gateway de persistencia de dominio.
- Supabase tiene migrations para `public.events`, `public.wallets`, `public.transactions`, `public.service_subscriptions` y `public.payment_policies`.
- Esas tablas permiten lectura/escritura amplia a `anon`/`authenticated`; son demo, no una frontera aceptable para datos financieros.
- Expo usa PostgREST directamente en `frontend/src/services/eventService.ts` y `frontend/src/services/appDataService.ts`.
- El flujo Stellar actual firma en el cliente y envía el XDR al Edge Function `stellar-relayer`.
- El checkout no está enlazado al proyecto Cloud: `npx supabase migration list` devuelve `LegacyProjectNotLinkedError`. No asumir estado remoto hasta enlazar y leerlo.
- Hay cambios preexistentes y protegidos en:
  - `backend/.env.example`
  - `frontend/.env.example`

El plan anterior `.hermes/plans/2026-09-19_162107-complete-api-supabase-core-settlement.md` describe otro alcance (gastos/settlement/disputas y sin wallets/Stellar). Sirve como antecedente, pero **no** es la fuente de implementación de esta fase.

## Límites del alcance

### Incluido

1. Auth JWT de Supabase en FastAPI.
2. Perfil ligado a `auth.users`.
3. Persistencia de eventos actuales; create/list/get autenticados.
4. Wallet metadata no custodial, plural, y balance vía adapter.
5. Registro de assets y política versionada con allowlists de destinatarios/activos.
6. Solicitud de pago directa entre dos perfiles.
7. Evaluación determinista de política y decisión manual.
8. Ejecución mock transaccional.
9. Envío Stellar Testnet de autorización Soroban firmada por cliente, persistencia y reconciliación.
10. Corte de acceso directo a tablas demo y migración de los servicios frontend a FastAPI.

### Diferido

- gastos, splits, settlement grupal, disputas y revisiones de settlement;
- x402/facilitator genérico;
- mainnet o dinero real;
- custodia o firma server-side;
- ejecución autónoma sin presencia del firmante (la passkey actual exige autorización en el dispositivo);
- staking y fondos comunes;
- notificaciones push y workers distribuidos.
- CRUD completo de grupos más allá de persistir los eventos actuales.

Una solicitud puede referenciar opcionalmente un evento visible, pero esta fase no calcula deudas desde gastos. No inventar un Settlement Engine incompleto dentro de la API de pagos.

## Decisiones de arquitectura

### Dinero y activo

- Sólo enteros `amount_minor`; nunca `float` ni `numeric` decimal en la API.
- En JSON, `amount_minor` viaja como string decimal para no perder precisión en JavaScript.
- `asset_scale` viene del registro del asset; USDC Stellar usa escala 7, pero no se infiere por el ticker.
- Máximo: `9_000_000_000_000_000`.
- `145000000` representa `14.5` unidades con escala 7.
- Pydantic valida una cadena de dígitos canónica y la convierte a un value object entero; rechaza float, exponente, signo, bool, cero y overflow.
- PostgreSQL usa `bigint` + checks de rango.
- El MVP habilita un solo registro USDC Testnet cuyo SAC contract ID se verifica; no usa XLM como fallback silencioso.

### Identidad y RLS

- El actor siempre sale de `sub` validado; ningún body acepta `user_id` para representar al actor.
- La identidad de dominio usa Supabase Auth con email/magic link y JWT. FastAPI rechaza sesiones anónimas para `/api/v1/*`; la passkey de wallet no reemplaza el login de aplicación.
- El JWT anónimo que hoy obtiene el frontend sólo para el relayer es deuda técnica y se elimina durante el cutover. El relayer recibe un JWT real + ticket/preparation one-time.
- Las tablas nuevas viven en schema privado `patopay`, fuera del Data API.
- Un rol runtime sin DDL ni `BYPASSRLS` ejecuta la app.
- Cada UoW hace `set_config('request.jwt.claim.sub', :sub, true)` dentro de la transacción. `true` evita filtrar identidad al siguiente checkout del pool.
- RLS es defensa en profundidad; los casos de uso también validan actor y transición.

### Wallet y Stellar

- `wallets` guarda sólo metadata pública de asociación: owner, provider, network, contract address, WASM/creation hash y estado. El asset vive en su registry separado.
- No guardar credential ID si el backend no lo necesita; nunca guardar private key, seed, passkey secret o XDR firmado después de la retención necesaria para la ejecución.
- La C-account no firma el envelope: la passkey firma auth entries de una invocación Soroban; el G-account del relayer paga fees y firma el envelope final. El cliente puede transportar esas auth entries dentro de un XDR preparado, pero API/domain lo nombra `signed_authorization`, no “private key” ni “signed transaction”.
- FastAPI decodifica y valida semánticamente contrato, función, árbol de subinvocaciones, authorizer/from, to, asset, amount, red y expiración contra el PaymentRequest antes de mandarlo al relayer.
- Antes de pagar fees, el submitter re-simula en enforcing mode para validar firmas y `__check_auth`; recording mode solo no alcanza.
- El adapter Stellar usa Testnet solamente en esta fase.
- Un timeout después de enviar no significa “falló”: queda `submitted/unknown` y se reconcilia por hash/provider reference.
- Nunca hacer fallback silencioso de Stellar a mock.

### Política v1

Orden de evaluación, con snapshot de la política usada:

1. bloquear si `recipient_mode=allowlist` y el destinatario no está en `allowed_recipients`;
2. bloquear si el asset no está en `allowed_assets`;
3. bloquear si el total confirmado del día UTC + monto supera `daily_limit_minor`;
4. `eligible_for_auto_approval` si `amount_minor <= auto_pay_limit_minor`;
5. `approval_required` si `amount_minor <= approval_limit_minor`;
6. bloquear por `approval_limit_exceeded` si supera `approval_limit_minor`.

Invariantes de configuración:

```text
0 <= auto_pay_limit_minor <= approval_limit_minor
0 < daily_limit_minor <= 9_000_000_000_000_000
allowed_assets contiene al menos el USDC Testnet habilitado
```

`eligible_for_auto_approval` saltea la decisión manual, **no** firma Stellar. La firma de passkey sigue siendo necesaria para ejecutar. Esta distinción debe aparecer en OpenAPI y UI.

### Estados

```text
PaymentRequest:
pending_approval -> approved | rejected | expired | cancelled
approved -> expired | cancelled   # sólo antes de submit
blocked                            # terminal como decisión de policy

PaymentAttempt / Transaction:
prepared -> submitting -> submitted -> confirmed | failed | unknown
unknown -> submitted | confirmed | failed
prepared -> simulated                 # adapter mock; nunca "confirmed"
```

`paid` es una proyección de lectura: existe sólo cuando hay un attempt Stellar `confirmed`. `pending` representa un attempt `submitted|unknown`. `simulated` jamás se proyecta como `paid`. Las decisiones son append-only. El estado del request se actualiza con versión optimista. Nunca borrar ni reescribir una decisión anterior.

### Idempotencia y red externa

- `Idempotency-Key` obligatorio en crear request, decidir y ejecutar.
- Key única por `(actor_id, method, path, key)` más hash canónico del payload.
- Misma key + mismo payload devuelve status/body original.
- Misma key + payload distinto devuelve `409`.
- No mantener una transacción DB abierta durante HTTP/RPC Stellar:
  1. claim transaccional de la ejecución;
  2. llamada externa;
  3. persistencia transaccional del resultado;
  4. reconciliación si el resultado quedó incierto.

## Contrato HTTP objetivo

Todas las rutas salvo `/health`, `/ready`, `/docs`, `/redoc` y `/openapi.json` requieren bearer válido.

| Método | Ruta | Éxito | Regla |
|---|---|---:|---|
| `GET` | `/api/v1/me` | 200 | Perfil del `sub` |
| `PUT` | `/api/v1/me` | 200 | Completa/upserta display name, username y notificaciones durante onboarding |
| `PATCH` | `/api/v1/me` | 200 | Cambia sólo campos editables del propio perfil |
| `GET` | `/api/v1/profiles?username=` | 200/404 | Lookup exacto; sólo datos públicos mínimos |
| `POST` | `/api/v1/events` | 201 | Owner derivado del JWT |
| `GET` | `/api/v1/events` | 200 | Sólo eventos propios/participados |
| `GET` | `/api/v1/events/{event_id}` | 200 | Ajeno se oculta como 404 |
| `POST` | `/api/v1/me/wallets` | 201 | Registra metadata pública; nunca crea/firma una wallet |
| `GET` | `/api/v1/me/wallets` | 200 | Lista wallets propias, sin secretos |
| `GET` | `/api/v1/me/wallets/{wallet_id}` | 200/404 | Detalle propio |
| `DELETE` | `/api/v1/me/wallets/{wallet_id}` | 204 | Deshabilita; no borra historia |
| `GET` | `/api/v1/me/wallets/{wallet_id}/balance` | 200 | Adapter según provider; monto minor |
| `GET` | `/api/v1/me/payment-policy` | 200 | Devuelve versión vigente/default seguro |
| `PUT` | `/api/v1/me/payment-policy` | 200 | Crea nueva versión completa con optimistic lock |
| `GET` | `/api/v1/me/payment-policy/allowed-recipients` | 200 | Allowlist propia |
| `PUT` | `/api/v1/me/payment-policy/allowed-recipients/{profile_id}` | 204 | Agrega idempotente |
| `DELETE` | `/api/v1/me/payment-policy/allowed-recipients/{profile_id}` | 204 | Quita idempotente |
| `GET` | `/api/v1/me/service-subscriptions` | 200 | Preferencias propias |
| `PUT` | `/api/v1/me/service-subscriptions/{service_id}` | 200 | Upsert propio |
| `POST` | `/api/v1/payment-requests` | 201 | Solicitante=current user; payer distinto |
| `GET` | `/api/v1/payment-requests` | 200 | `direction`, `status`, cursor |
| `GET` | `/api/v1/payment-requests/{request_id}` | 200 | Sólo payer/requester |
| `POST` | `/api/v1/payment-requests/{request_id}/approve` | 200 | Sólo payer; registra aprobación, no paga |
| `POST` | `/api/v1/payment-requests/{request_id}/reject` | 200 | Sólo payer; registra rechazo append-only |
| `POST` | `/api/v1/payment-requests/{request_id}/prepare` | 200 | Request aprobado; fija operación canónica y expiración corta |
| `POST` | `/api/v1/payment-requests/{request_id}/execute` | 202/200 | Consume preparation y autorización firmada; no acepta monto/destino libres |
| `GET` | `/api/v1/transactions` | 200 | Propias, cursor |
| `GET` | `/api/v1/transactions/{transaction_id}` | 200 | Sólo partes |
| `POST` | `/api/v1/transactions/{transaction_id}/refresh` | 200 | Reconciliación idempotente |

Payload de creación v1:

```json
{
  "payer_profile_id": "uuid",
  "amount_minor": "145000000",
  "asset_id": "uuid-del-usdc-testnet-habilitado",
  "memo": "Asado del viernes"
}
```

El requester y su wallet destino se derivan del JWT/DB. No aceptar `requester_id`, `recipient_wallet_address`, status, policy outcome ni tx hash del cliente.

Respuesta de aprobación:

```json
{
  "id": "payment-request-uuid",
  "status": "approved",
  "nextAction": "prepare_sign_and_execute"
}
```

`prepare` devuelve una unión por modo. En Stellar incluye `preparationId`, expiración, resumen canónico para UI y el material público/unsigned necesario para que `passkey-kit` firme las auth entries. No incluye secretos. `execute` recibe sólo `preparationId` + `signedAuthorization`; el backend vuelve a comparar semánticamente el contenido firmado con la intención persistida.

Respuesta Stellar confirmada de `execute` o `refresh`:

```json
{
  "mode": "stellar",
  "status": "paid",
  "txHash": "64-hex-reales",
  "explorerUrl": "https://stellar.expert/explorer/testnet/tx/64-hex-reales",
  "amountMinor": "100000000",
  "amount": "10.0000000",
  "asset": "USDC"
}
```

`amount` es string de display, no float. El valor canónico es `amountMinor` + decimals del asset. Si el relayer aceptó pero RPC aún no confirmó, responder `202` con `status=pending`, transaction ID y sin afirmar éxito final.

Respuesta mock:

```json
{
  "mode": "mock",
  "status": "simulated",
  "simulationId": "uuid",
  "amountMinor": "100000000",
  "amount": "10.0000000",
  "asset": "USDC"
}
```

Mock no contiene `txHash` ni `explorerUrl`.

### Mapeo desde el contrato propuesto por frontend

| Pedido inicial | Contrato acordado | Motivo |
|---|---|---|
| `POST /users` | Supabase Auth + `PUT /api/v1/me` | No crear una identidad paralela ni aceptar un user ID arbitrario |
| `GET /users/:id` | `GET /api/v1/profiles?username=` o perfil público mínimo por ID | Evitar exponer email/metadata privada |
| `POST /wallets` | `POST /api/v1/me/wallets` | Owner siempre derivado del JWT; sólo registra metadata |
| `GET /wallets/:userId` | `GET /api/v1/me/wallets` | No enumerar wallets ajenas |
| `GET/PUT /policies/:userId` | `GET/PUT /api/v1/me/payment-policy` | Policy propia, versionada y derivada del JWT |
| `POST /payments-requests` | `POST /api/v1/payment-requests` | Corregir plural inconsistente |
| `approve/reject` | endpoints explícitos separados | Consentimiento append-only, sin confundirlo con settlement |
| `GET /transactions` | `GET /api/v1/transactions` | Historial de intentos PatoPay visibles al actor, no indexador universal de Stellar |

Semántica uniforme:

- `401`: token ausente/inválido/expirado;
- `403`: autenticado, pero transición no autorizada;
- `404`: recurso inexistente o no visible;
- `409`: versión/estado/idempotencia/duplicado/conflicto;
- `422`: shape o invariantes de entrada;
- `502`: relayer/RPC devolvió una respuesta inválida o rechazo técnico;
- `503`: integración requerida no configurada/disponible;
- error envelope: `{"error":{"code":"...","message":"...","details":null}}`.

## Modelo persistente objetivo

Schema `patopay`:

| Tabla | Campos/constraints clave |
|---|---|
| `profiles` | `id uuid PK -> auth.users`, `username citext UNIQUE NULL`, `display_name`, `notifications_enabled`, timestamps; email queda sólo en Supabase Auth |
| `profile_directory` | view de `id`, `username`, `display_name`; nunca email/Auth metadata; lookup exacto autenticado |
| `events` | id, owner_id, name, status `draft`, version, timestamps |
| `event_participants` | PK event/user, role owner/member |
| `assets` | id, network, SAC contract address, code, decimals, enabled; unique network/address |
| `wallets` | id, user_id, provider mock/stellar, network mock/testnet, contract_address, wallet_wasm_hash, creation_tx_hash, status, is_default, version; dirección única por red |
| `mock_wallet_balances` | wallet PK, balance_minor >= 0; sólo adapter mock |
| `payment_policy_versions` | id, user, version, auto/approval/daily limits minor, recipient_mode, policy_contract_address/on_chain_revision nullable, created_at |
| `policy_allowed_recipients` | PK policy_version/recipient_profile; no self |
| `policy_allowed_assets` | PK policy_version/asset; sólo assets enabled |
| `service_subscriptions` | PK user/service, enabled, updated_at |
| `payment_requests` | requester, payer, wallet origen/destino, asset, monto inmutable, memo, decision status, policy version/snapshot, version, timestamps |
| `policy_decisions` | request, actor nullable para engine, source policy/manual, outcome, reason_code, policy_snapshot JSONB, created_at; append-only |
| `payment_attempts` | request, attempt number, executor, mode/status, preparation hash/expiry/consumed_at, envelope hash, tx_hash/provider_reference, ledger/receipt, safe error code, timestamps |
| `idempotency_keys` | actor/method/path/key PK, request hash, response status/body, created_at |

Constraints mínimas:

- monto positivo y acotado;
- payer != requester y from wallet != to wallet;
- wallet address única por provider/network;
- transaction hash única cuando no es NULL;
- un intento activo por request;
- policy thresholds ordenados y al menos un asset permitido;
- version >= 1;
- no cascade desde `auth.users` a historia de pagos;
- índices por participant, payer, requester, status, created_at y request.

No usar `Base.metadata.create_all()` en runtime. Las SQL migrations de Supabase son la fuente de verdad; el gateway PostgREST debe respetar sus tablas, grants y RLS.

---

# Fases de implementación

## Fase 0 — Preflight y protección del worktree

### Dependencias

Ninguna. Es gate obligatorio antes de editar.

### Comandos

Desde la raíz:

```bash
cd /home/jhaycortez/code/f-projects/f-pato_pay
git rev-parse --show-toplevel
git status --short --branch
git diff -- backend/.env.example frontend/.env.example
git diff --cached --name-only
git diff --check
test ! -d .git/rebase-merge
test ! -d .git/rebase-apply

git switch -c feat/backend-domain-api

cd backend
uv sync --frozen
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
uv run mypy src
```

### Protección explícita

- No ejecutar `reset`, `clean`, `checkout --`, `restore`, `stash` ni `git add .`.
- Guardar el diff inicial de ambos `.env.example` como referencia fuera del repo:

```bash
git diff -- backend/.env.example frontend/.env.example \
  > /tmp/patopay-env-example-before-backend-plan.patch
```

- Esos archivos siguen siendo trabajo del usuario. Las variables nuevas se documentan primero en `docs/backend-domain-api.md`.
- Para editar/stagear un `.env.example`, primero obtener aprobación sobre el diff actual y usar `git add -p`; si los hunks se solapan, no tocarlo en esta rama.
- En cada commit: `git diff --cached --name-only` y `git diff --cached --check` antes de confirmar.

### Gate

- Mismo baseline: 11 tests y tres checks limpios.
- Sólo los dos `.env.example` preexistentes figuran modificados antes de empezar.
- Rama nueva creada, sin operación Git interrumpida.

No hay commit funcional en esta fase.

## Fase 1 — Contrato de configuración, dependencias y composition root

### Dependencias

Fase 0.

### RED

Mover el test de configuración existente y crear el de composition:

- `backend/tests/unit/test_config.py`
- `backend/tests/unit/test_composition.py`

```bash
mkdir -p tests/unit
git mv tests/test_config.py tests/unit/test_config.py
```

Un test por comportamiento:

1. mock inicia sin URLs/credenciales Stellar;
2. stellar falla temprano si faltan RPC, relayer o asset contract;
3. provider inválido falla;
4. usuario Supabase anónimo se rechaza aunque tenga un JWT firmado;
5. ningún secret aparece en `repr(Settings)` ni logs;
6. `create_app()` inyecta verifier/UoW/executor elegidos, sin fallback.

Ejemplo de RED focalizado:

```bash
cd /home/jhaycortez/code/f-projects/f-pato_pay/backend
uv run pytest tests/unit/test_config.py::test_stellar_executor_requires_complete_configuration -q
```

RED válido: setting/validator faltante, no error de import o fixture.

### GREEN/REFACTOR

Modificar:

- `backend/pyproject.toml`
- `backend/uv.lock`
- `backend/src/patopay/config.py`
- `backend/src/patopay/main.py`

Agregar dependencias runtime:

```bash
uv add 'pyjwt[crypto]>=2.10,<3' 'httpx>=0.28,<1' 'stellar-sdk>=15,<16' 'email-validator>=2.2,<3'
```

Settings nuevos, sin valores reales:

```text
PATOPAY_PAYMENT_EXECUTOR=mock|stellar
PATOPAY_STELLAR_NETWORK=testnet
PATOPAY_STELLAR_RPC_URL=
PATOPAY_STELLAR_RELAYER_URL=
PATOPAY_STELLAR_ASSET_CONTRACT_ID=
PATOPAY_STELLAR_ASSET_CODE=USDC
PATOPAY_STELLAR_ASSET_SCALE=7
PATOPAY_SUPABASE_TIMEOUT_SECONDS=10
```

Mover `httpx` a runtime para el adapter Supabase/PostgREST. No usar un driver PostgreSQL ni abrir conexiones SQL desde FastAPI: Auth se valida por JWT/JWKS y las operaciones de dominio pasan por la API Supabase.

### Gate

```bash
uv run pytest tests/unit/test_config.py tests/unit/test_composition.py -q
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
uv run mypy src
```

Aceptación:

- mock corre offline;
- stellar incompleto no arranca;
- adapter seleccionado es observable y nunca cae a otro;
- cambios protegidos de env siguen sin stagear.

### Commit

Stage exacto y commit:

```bash
git add backend/pyproject.toml backend/uv.lock \
  backend/src/patopay/config.py backend/src/patopay/main.py \
  backend/tests/unit/test_config.py backend/tests/unit/test_composition.py
git diff --cached --check
git commit -m "chore: configure authenticated payment backends"
```

## Fase 2 — Dominio puro: dinero, políticas y máquinas de estado

### Dependencias

Fase 1.

### RED

Crear:

- `backend/tests/unit/domain/test_money.py`
- `backend/tests/unit/domain/test_policy.py`
- `backend/tests/unit/domain/test_payment_request.py`
- `backend/tests/unit/domain/test_transaction.py`

Slices, una por vez:

- dinero rechaza float, bool, cero, negativos y overflow;
- thresholds auto/approval desordenados fallan;
- allowlist bloquea destinatario no permitido;
- asset fuera de allowlist bloquea;
- approval limit y daily limit bloquean con reason code distinto;
- <= auto produce `eligible_for_auto_approval` pero no `paid`;
- tramo manual produce `approval_required`;
- sobre approval limit produce `blocked`;
- transiciones válidas funcionan;
- transición repetida/terminal falla;
- decisiones no mutan snapshots previos.

Primer RED:

```bash
uv run pytest tests/unit/domain/test_money.py::test_amount_minor_rejects_float_and_bool -q
```

### GREEN/REFACTOR

Crear:

- `backend/src/patopay/domain/money.py`
- `backend/src/patopay/domain/policies.py`
- `backend/src/patopay/domain/payments.py`
- `backend/src/patopay/domain/transactions.py`
- `backend/src/patopay/domain/errors.py`

Usar dataclasses/enums puros. Nada de FastAPI, SQLAlchemy, HTTP o reloj global dentro de domain; pasar `now` y gasto diario como inputs.

### Gate

```bash
uv run pytest tests/unit/domain -q
uv run pytest -q
uv run ruff check src/patopay/domain tests/unit/domain
uv run ruff format --check src/patopay/domain tests/unit/domain
uv run mypy src
```

Aceptación: matriz de política completa, estados terminales protegidos y montos exactos.

### Commit

```bash
git add backend/src/patopay/domain backend/tests/unit/domain
git commit -m "feat: define payment policy and transaction domain"
```

## Fase 3 — Migrations privadas, RLS y cierre del modelo demo

### Dependencias

Fase 2. Docker/Supabase CLI para gate local.

### Preflight remoto de sólo lectura

Antes de diseñar backfill, enlazar de forma interactiva; no poner token/ref/password en archivos ni comandos compartidos:

```bash
cd /home/jhaycortez/code/f-projects/f-pato_pay
npx supabase login
npx supabase link --project-ref "$SUPABASE_PROJECT_REF"
npx supabase migration list
npx supabase db pull remote_baseline
npx supabase db push --dry-run
```

Si `db pull` o dry-run muestran drift inesperado, parar. No ejecutar `migration repair` ni `db reset --linked`.

Inventariar sin imprimir PII:

```sql
select 'events' as table_name, count(*) from public.events
union all select 'wallets', count(*) from public.wallets
union all select 'transactions', count(*) from public.transactions
union all select 'service_subscriptions', count(*) from public.service_subscriptions
union all select 'payment_policies', count(*) from public.payment_policies;
```

Gate de producto: confirmar que esos registros son demo descartable. Si hay datos reales, agregar mapping auth-user por auth-user; no copiar UUID arbitrarios a FKs de `auth.users`.

### RED DB

Crear:

- `supabase/tests/database/001_backend_core_schema.test.sql`
- `supabase/tests/database/002_backend_core_rls.test.sql`
- `supabase/tests/database/003_backend_core_constraints.test.sql`

Exigir con pgTAP:

- schema/tablas/índices/constraints;
- view `profile_directory` sin email ni metadata privada;
- `ENABLE` + `FORCE ROW LEVEL SECURITY`;
- `anon`, `authenticated` y `public` sin grants directos;
- runtime role sin superuser/BYPASSRLS/DDL;
- trigger `auth.users -> profiles` idempotente;
- identidad por `request.jwt.claim.sub`;
- user A no ve/escribe user B;
- tablas append-only rechazan UPDATE/DELETE del runtime.

```bash
npx supabase start
npx supabase test db
```

RED esperado: objetos faltantes.

### GREEN/REFACTOR

Crear:

- `supabase/migrations/20260920000300_create_backend_core.sql`
- `supabase/migrations/20260920000400_lock_down_legacy_app_state.sql`
- `supabase/seed.sql` con UUIDs/montos ficticios o deshabilitar seed hasta crearlo.

La migration `00300` crea `patopay`, tablas, trigger y policies para `authenticated`. La `00400` debe:

1. revocar INSERT/UPDATE/DELETE públicos de las tablas demo;
2. no dropear tablas todavía;
3. opcionalmente dejar SELECT temporal sólo si el frontend aún no cortó;
4. documentar la migration de drop para después del rollout.

No poner passwords en migrations. El script de provision recibe `runtime_password` por variable `psql`.

### Gate

```bash
npx supabase db reset
npx supabase db reset
npx supabase db lint
npx supabase test db
```

Además, conectado como runtime:

- DML propio permitido;
- lectura cruzada denegada;
- `CREATE TABLE`/`ALTER TABLE` denegados;
- dos resets consecutivos sin drift.

### Commit

```bash
git add supabase/migrations/20260920000300_create_backend_core.sql \
  supabase/migrations/20260920000400_lock_down_legacy_app_state.sql \
  supabase/tests/database supabase/seed.sql
git commit -m "feat: define private authenticated payment schema"
```

## Fase 4 — Adapter Supabase/PostgREST, repositorios HTTP y contexto autenticado

### Dependencias

Fase 3 y acceso HTTP a Supabase Cloud. No requiere PostgreSQL local ni `supabase start`.

### RED

Crear:

- `backend/tests/test_supabase_client.py`
- `backend/tests/unit/test_composition.py`
- `backend/tests/test_supabase_lifecycle.py`

Slices:

1. el cliente usa el publishable key en `apikey`;
2. las operaciones de dominio propagan el JWT real como `Authorization: Bearer`;
3. readiness consulta `/rest/v1/` y mapea errores a `503`;
4. table gateway valida nombres de tabla y construye filtros PostgREST;
5. insert/update usan `Prefer: return=representation`;
6. RPC permite encapsular operaciones multi-row atómicas en funciones SQL de Supabase;
7. ningún request usa DSN, Psycopg, SQLAlchemy ni service role.

```bash
uv run pytest tests/test_supabase_client.py::test_supabase_client_forwards_user_jwt_to_postgrest -q
```

### GREEN/REFACTOR

Crear:

- `backend/src/patopay/application/ports/supabase.py`
- `backend/src/patopay/infrastructure/supabase/client.py`
- `backend/src/patopay/infrastructure/supabase/gateway.py`

El cliente debe usar `httpx.AsyncClient`, timeout configurable, `apikey`
publishable y JWT por request. La persistencia multi-row que requiera atomicidad
se implementará como RPC SQL en Supabase y se invocará por PostgREST; no se
simula una Unit of Work Python que no pueda garantizar rollback remoto.

### Gate

```bash
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
uv run mypy src
```

Aceptación: FastAPI no importa `sqlalchemy`/`psycopg`, no recibe
`PATOPAY_DATABASE_URL`, no usa `service_role` y todas las operaciones privadas
requieren JWT de Supabase. Las migrations y pgTAP se validan con Supabase CLI
contra el proyecto/local stack sólo cuando el entorno Docker/CLI está disponible.

### Commit

```bash
git add backend/pyproject.toml backend/uv.lock \
  backend/src/patopay/application/ports \
  backend/src/patopay/infrastructure/supabase \
  backend/src/patopay/main.py backend/src/patopay/api/routes/health.py \
  backend/tests docs supabase/config.toml
 git diff --cached --check
git commit -m "refactor: use Supabase API instead of direct database access"
```

## Fase 5 — JWT Supabase y perfil actual

### Dependencias

Fases 1 y 4.

### RED

Crear:

- `backend/tests/unit/infrastructure/test_supabase_jwt.py`
- `backend/tests/api/test_auth.py`
- `backend/tests/api/test_profile_api.py`

Casos:

- sin header/no Bearer -> 401;
- firma, `kid`, issuer, audience, expiry, sub o role inválidos -> 401;
- JWKS rota: refresca una vez y reintenta;
- anonymous siempre rechazado en rutas de dominio;
- token válido crea/lee perfil por `sub`;
- PATCH no puede cambiar id/email/roles;
- lookup por username es exacto y devuelve sólo id/username/display_name;
- errores no imprimen bearer/JWT/JWKS payload completo.

Tests unitarios usan claves efímeras locales o fake verifier. Ningún test normal llama Supabase.

### GREEN/REFACTOR

Crear:

- `backend/src/patopay/infrastructure/auth/supabase_jwt.py`
- `backend/src/patopay/application/use_cases/profiles.py`
- `backend/src/patopay/api/dependencies.py`
- `backend/src/patopay/api/errors.py`
- `backend/src/patopay/api/schemas/profiles.py`
- `backend/src/patopay/api/routes/profiles.py`

Validar sólo algoritmos asimétricos permitidos (`ES256`/`RS256`), `iss`, `aud=authenticated`, `exp`, UUID de `sub` y role. No guardar/cargar JWT secret HS256. Si el proyecto remoto todavía usa legacy HS256, usar temporalmente `/auth/v1/user` server-side y abrir migration explícita; nunca copiar el JWT secret a FastAPI.

### Gate

```bash
uv run pytest tests/unit/infrastructure/test_supabase_jwt.py \
  tests/api/test_auth.py tests/api/test_profile_api.py -q
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
uv run mypy src
```

### Commit

```bash
git add backend/src/patopay/infrastructure/auth \
  backend/src/patopay/application/use_cases/profiles.py \
  backend/src/patopay/api backend/tests/unit/infrastructure \
  backend/tests/api/test_auth.py backend/tests/api/test_profile_api.py
git commit -m "feat: authenticate API users with Supabase JWT"
```

## Fase 6 — Eventos autenticados y persistentes

### Dependencias

Fases 4 y 5.

### RED

Crear/mover a `backend/tests/api/test_events_api.py` y `backend/tests/integration/postgres/test_event_repository.py`:

- create body acepta sólo `name`;
- owner = JWT `sub`; creator/user spoof -> 422;
- owner participant se crea atómicamente;
- list/get sólo visible a participantes;
- persistencia sobrevive nueva app/session;
- rollback no deja participant huérfano;
- cursor `(created_at,id)` estable.

### GREEN/REFACTOR

Crear:

- `backend/src/patopay/application/use_cases/events.py`
- `backend/src/patopay/api/schemas/events.py`
- actualizar `backend/src/patopay/api/routes/events.py`
- repository event bajo `infrastructure/postgres/repositories/`.

Eliminar sólo después de GREEN:

- `backend/src/patopay/infrastructure/memory_event_service.py`
- viejo `EventService` en `application/ports.py`
- tests de memoria reemplazados.

### Gate

```bash
uv run pytest tests/api/test_events_api.py \
  tests/integration/postgres/test_event_repository.py -q
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
uv run mypy src
git grep -n 'InMemoryEventService\|ParticipantInput' -- backend/src backend/tests || true
```

Aceptación: no queda ruta de producción en memoria ni actor en body.

### Commit

```bash
git add backend/src/patopay backend/tests
git commit -m "feat: persist authenticated events"
```

## Fase 7 — Asset USDC, wallets y balance por adapter

### Dependencias

Fases 4 y 5; Fase 2 para money.

### RED

Crear:

- `backend/tests/unit/application/test_wallets.py`
- `backend/tests/unit/application/test_assets.py`
- `backend/tests/api/test_wallet_api.py`
- `backend/tests/integration/postgres/test_wallet_repository.py`
- `backend/tests/unit/infrastructure/payments/test_mock_wallet_gateway.py`
- `backend/tests/unit/infrastructure/payments/test_stellar_balance_gateway.py`

Casos:

- registry habilita sólo el SAC USDC Testnet configurado y verificado;
- usuario sólo registra/lista/lee/deshabilita sus wallets;
- dirección/provider/network inválidos -> 422;
- address duplicada -> 409;
- una default activa por usuario/red y cambio necesita `expected_version`;
- responses nunca contienen credential/private material;
- wallet Stellar nueva queda `unverified`; no se afirma ownership criptográfico al registrarla;
- una ejecución válida desde esa C-account demuestra control para esa operación;
- mock devuelve balance minor exacto;
- Stellar parsea respuesta RPC y mapea timeout/error seguro;
- adapter stellar se prueba con `httpx.MockTransport`, sin red.

### GREEN/REFACTOR

Crear:

- `backend/src/patopay/application/use_cases/wallets.py`
- `backend/src/patopay/application/ports/wallets.py`
- `backend/src/patopay/infrastructure/payments/mock.py`
- `backend/src/patopay/infrastructure/payments/stellar.py`
- `backend/src/patopay/api/schemas/wallets.py`
- `backend/src/patopay/api/routes/wallets.py`

`POST /me/wallets` registra metadata producida por el cliente después de crear/conectar la smart wallet. En v1 esto no es prueba criptográfica de ownership: queda `unverified` y `execute` debe validar que el authorizer/`from` del XDR coincide exactamente. No usar una wallet no verificada como prueba de identidad. Diseñar el registro plural desde el inicio para no acoplar `User` a una sola dirección.

### Gate

```bash
uv run pytest tests/unit/application/test_wallets.py tests/api/test_wallet_api.py \
  tests/integration/postgres/test_wallet_repository.py \
  tests/unit/infrastructure/payments -q
uv run pytest -q && uv run ruff check . && uv run ruff format --check . && uv run mypy src
```

### Commit

```bash
git add backend/src/patopay backend/tests
git commit -m "feat: manage user wallets through adapters"
```

## Fase 8 — Policy versions, allowlists y service subscriptions

### Dependencias

Fases 2, 4 y 5.

### RED

Crear:

- `backend/tests/unit/application/test_policies.py`
- `backend/tests/api/test_policy_api.py`
- `backend/tests/api/test_service_subscriptions_api.py`
- `backend/tests/integration/postgres/test_policy_repository.py`

Casos:

- GET crea default seguro una sola vez con USDC Testnet permitido;
- PUT crea una nueva versión completa y valida auto/approval/daily, recipient mode, allowed recipients, allowed assets y `expected_version`;
- stale update -> 409;
- user B no ve ni cambia política/allowlist de A;
- recipient inexistente/self -> 404/422;
- asset deshabilitado/desconocido -> 422;
- una versión usada por un request nunca se actualiza ni borra;
- allowlist add/delete idempotente;
- service subscription sólo usa service IDs permitidos y queda scoped al actor.

### GREEN/REFACTOR

Crear:

- `backend/src/patopay/application/use_cases/policies.py`
- `backend/src/patopay/application/use_cases/service_subscriptions.py`
- `backend/src/patopay/api/schemas/policies.py`
- `backend/src/patopay/api/schemas/service_subscriptions.py`
- `backend/src/patopay/api/routes/policies.py`
- `backend/src/patopay/api/routes/service_subscriptions.py`

No evaluar política en routes. El caso de uso devuelve el aggregate y persiste versionado.

### Gate

```bash
uv run pytest tests/unit/application/test_policies.py \
  tests/api/test_policy_api.py tests/api/test_service_subscriptions_api.py \
  tests/integration/postgres/test_policy_repository.py -q
uv run pytest -q && uv run ruff check . && uv run ruff format --check . && uv run mypy src
```

### Commit

```bash
git add backend/src/patopay backend/tests
git commit -m "feat: persist payment policies and preferences"
```

## Fase 9 — PaymentRequest + evaluación/persistencia de decisión

### Dependencias

Fases 2, 4, 5, 7 y 8.

### RED

Crear:

- `backend/tests/unit/application/test_create_payment_request.py`
- `backend/tests/api/test_payment_requests_api.py`
- `backend/tests/integration/postgres/test_create_payment_request.py`

Slices:

1. requester/payer distintos y ambos perfiles/wallets activos;
2. requester derivado del JWT; payer se resuelve desde un ID obtenido por lookup exacto;
3. request + policy decision se escriben en una transacción;
4. eligible auto -> approved + `prepare_sign_and_execute`; manual -> pending_approval; block -> blocked;
5. daily spend usa transacciones `confirmed` del payer en día UTC;
6. list/get sólo para las partes, con direction/cursor;
7. misma idempotency key replay; payload distinto -> 409;
8. carrera concurrente no duplica request/decision.

### GREEN/REFACTOR

Crear:

- `backend/src/patopay/application/use_cases/payment_requests.py`
- `backend/src/patopay/application/services/policy_evaluator.py`
- `backend/src/patopay/api/schemas/payment_requests.py`
- `backend/src/patopay/api/routes/payment_requests.py`

Persistir snapshot completo de thresholds/allowlist outcome y `reason_code`, no texto de UI como única auditoría.

### Gate

```bash
uv run pytest tests/unit/application/test_create_payment_request.py \
  tests/api/test_payment_requests_api.py \
  tests/integration/postgres/test_create_payment_request.py -q
uv run pytest -q && uv run ruff check . && uv run ruff format --check . && uv run mypy src
```

Aceptación: no existe estado de request sin decisión inicial correspondiente.

### Commit

```bash
git add backend/src/patopay backend/tests
git commit -m "feat: create policy-evaluated payment requests"
```

## Fase 10 — Decisiones manuales append-only

### Dependencias

Fase 9.

### RED

Agregar a:

- `backend/tests/unit/application/test_decide_payment_request.py`
- `backend/tests/api/test_payment_request_decisions_api.py`
- `backend/tests/integration/postgres/test_payment_decisions.py`

Casos:

- sólo payer decide;
- sólo `pending_approval`;
- `/approve` -> approved + `next_action=prepare_sign_and_execute`, sin transaction ni tx hash;
- `/reject` requiere reason no vacío -> rejected;
- retry idempotente devuelve misma decisión;
- decisión opuesta/segunda -> 409;
- optimistic lock resuelve carrera;
- decisión anterior no se actualiza/borra.

### GREEN/REFACTOR

Crear/actualizar:

- `backend/src/patopay/application/use_cases/payment_decisions.py`
- `backend/src/patopay/api/schemas/payment_decisions.py`
- routes explícitas `/{id}/approve` y `/{id}/reject` bajo `payment_requests.py`; ambas reutilizan el mismo caso de uso append-only.

### Gate

```bash
uv run pytest tests/unit/application/test_decide_payment_request.py \
  tests/api/test_payment_request_decisions_api.py \
  tests/integration/postgres/test_payment_decisions.py -q
uv run pytest -q && uv run ruff check . && uv run ruff format --check . && uv run mypy src
```

### Commit

```bash
git add backend/src/patopay backend/tests
git commit -m "feat: record payment decisions append only"
```

## Fase 11 — Ejecución mock y ledger transaccional

### Dependencias

Fases 7, 9 y 10.

### RED

Crear:

- `backend/tests/unit/application/test_execute_payment.py`
- `backend/tests/api/test_execute_payment_mock_api.py`
- `backend/tests/integration/postgres/test_mock_execution.py`

Casos:

- sólo payer ejecuta request approved;
- request pending/blocked/rejected -> 409;
- saldo insuficiente -> failed seguro, sin débito parcial;
- éxito debita/acredita y crea attempt `simulated` atómicamente;
- misma key/request -> mismo attempt/simulation ID;
- dos ejecuciones concurrentes mueven fondos una vez;
- fallo a mitad hace rollback total;
- mock nunca devuelve `paid`, `txHash` ni `explorerUrl`; devuelve unión discriminada `mode=mock,status=simulated`.

### GREEN/REFACTOR

Crear:

- `backend/src/patopay/application/use_cases/execute_payment.py`
- `backend/src/patopay/infrastructure/payments/mock_executor.py`
- `backend/src/patopay/api/schemas/transactions.py`
- `backend/src/patopay/api/routes/transactions.py`

El mock usa la misma interface y estados que Stellar, no un shortcut desde route. El funding mock queda sólo en seed/test, no como endpoint de producción.

### Gate

```bash
uv run pytest tests/unit/application/test_execute_payment.py \
  tests/api/test_execute_payment_mock_api.py \
  tests/integration/postgres/test_mock_execution.py -q
uv run pytest -q && uv run ruff check . && uv run ruff format --check . && uv run mypy src
```

### Commit

```bash
git add backend/src/patopay backend/tests
git commit -m "feat: execute mock payments atomically"
```

## Fase 12 — Preparación Stellar Testnet, submit seguro y reconciliación

### Dependencias

Fase 11 y fixtures Stellar redactados.

### RED

Crear:

- `backend/tests/fixtures/stellar/valid_sac_transfer.json`
- `backend/tests/unit/infrastructure/payments/test_stellar_xdr.py`
- `backend/tests/unit/application/test_prepare_payment.py`
- `backend/tests/unit/infrastructure/payments/test_stellar_executor.py`
- `backend/tests/unit/application/test_reconcile_transaction.py`
- `backend/tests/api/test_execute_payment_stellar_api.py`
- `supabase/functions/stellar-relayer/index.test.ts`

Fixtures no contienen secret keys ni JWT.

Casos:

- sólo request aprobado puede preparar; preparation tiene intent hash, expiración corta y single use;
- preparation devuelve resumen idéntico al request y material unsigned, nunca secrets;
- falta `preparation_id`/signed authorization -> 422 en stellar;
- preparation vencida, consumida o de otro request/actor -> 409/404;
- XDR malformado/red equivocada/múltiples operations -> 422;
- SAC contract, función, auth tree/subinvocaciones, authorizer/from, to, amount o expiry distintos del request/preparation -> 422;
- enforcing simulation inválida -> 422 y no llama al relayer;
- relayer 4xx -> failed con error seguro;
- timeout/5xx incierto -> submitted/unknown, no reintento ciego;
- respuesta sin hash/provider ref -> 502;
- hash válida queda submitted hasta confirmación RPC;
- refresh success -> confirmed + request paid;
- refresh failed -> failed;
- mismo hash no se asocia a dos transactions;
- concurrent execute/refresh converge en un estado;
- Authorization, publishable key y XDR no aparecen en logs.

### GREEN/REFACTOR

Completar:

- `backend/src/patopay/infrastructure/payments/stellar_xdr.py`
- `backend/src/patopay/application/use_cases/prepare_payment.py`
- `backend/src/patopay/infrastructure/payments/stellar_executor.py`
- `backend/src/patopay/application/use_cases/reconcile_transaction.py`
- rutas execute/refresh.

Flujo:

1. `prepare`: lock request, validar actor/status, crear/reusar attempt `prepared`, fijar intent hash/expiración y construir la invocación canónica, commit.
2. Cliente: comparar resumen canónico, pedir presencia de passkey y firmar auth entries; nunca recibe una private key.
3. `execute`: lock attempt, comprobar single use y actor; decodificar signed authorization con network passphrase Testnet y comparar intención completa.
4. Enforcing simulation: ejecutar `__check_auth` y validar firma/policy antes de pagar fees.
5. HTTP: enviar sólo la invocación/auth permitidas al Edge Function/relayer con timeout acotado y headers redactados.
6. DB: consumir preparation y persistir hash/status con compare-and-set.
7. RPC refresh: sólo marca `confirmed` y proyecta `paid` después de evidencia on-chain consistente con el request.

Endurecer además `supabase/functions/stellar-relayer/index.ts` y agregar tests Deno: JWT no anónimo para operaciones de dominio, ticket/preparation one-time emitido por FastAPI, red/contrato/función/auth exactos, rechazo de operaciones extra y rate limit. El Edge Function no debe seguir siendo un relay genérico para cualquier `invokeHostFunction`.

No reenviar un XDR automáticamente después de timeout salvo que el protocolo del relayer admita una idempotency key comprobada. Preferir reconciliar por hash/provider reference.

### Gate offline obligatorio

```bash
uv run pytest tests/unit/infrastructure/payments/test_stellar_xdr.py \
  tests/unit/application/test_prepare_payment.py \
  tests/unit/infrastructure/payments/test_stellar_executor.py \
  tests/unit/application/test_reconcile_transaction.py \
  tests/api/test_execute_payment_stellar_api.py -q
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
uv run mypy src

cd ..
deno test supabase/functions/stellar-relayer/index.test.ts
```

### Smoke Testnet opt-in

Crear:

- `backend/scripts/smoke_stellar_testnet.py`
- `backend/tests/test_smoke_stellar_script.py`

Requiere secrets/tokens por entorno, nunca imprime XDR/JWT/key. Debe ejecutar una transferencia mínima entre wallets de test, consultar hash por RPC y luego leer la transaction exacta en FastAPI.

```bash
PATOPAY_RUN_STELLAR_SMOKE=1 uv run python scripts/smoke_stellar_testnet.py
```

No es parte de `pytest` normal. No declarar adapter real listo si sólo pasaron mocks.

### Commit

```bash
git add backend/src/patopay backend/tests backend/scripts/smoke_stellar_testnet.py \
  supabase/functions/stellar-relayer/index.ts \
  supabase/functions/stellar-relayer/index.test.ts
git commit -m "feat: execute and reconcile Stellar testnet payments"
```

## Fase 13 — Contrato OpenAPI, observabilidad y cutover frontend

### Dependencias

Fases 5–12.

### RED

Crear:

- `backend/tests/api/test_openapi.py`
- `backend/tests/api/test_error_contract.py`
- `backend/tests/api/test_request_logging.py`
- `backend/tests/api/test_readiness.py`
- `frontend` contract tests o tests de service según harness existente.

Exigir:

- endpoint matrix exacta y bearer declarado;
- `/health` no toca DB/red;
- `/ready` comprueba DB y config del provider, sin mover fondos;
- request ID en response/log;
- logs sin JWT/DSN/key/XDR/email completa;
- CORS para orígenes configurados;
- frontend ya no llama `/rest/v1/events`, `/wallets`, `/transactions`, `/payment_policies` ni `/service_subscriptions`;
- frontend adjunta el access token de Supabase a FastAPI.

### GREEN/REFACTOR backend

Crear/actualizar:

- `backend/src/patopay/api/router.py`
- `backend/src/patopay/api/middleware.py`
- `backend/src/patopay/api/routes/readiness.py`
- `docs/backend-domain-api.md`

### Cutover frontend coordinado

Cambios esperados, en commit separado del backend:

- crear `frontend/src/services/patopayApiClient.ts`;
- migrar `frontend/src/services/eventService.ts`;
- migrar `frontend/src/services/appDataService.ts`;
- integrar request/approve-or-reject/prepare/sign/execute en `frontend/app/payment/request.tsx`;
- registrar wallet backend después de creación en `wallet.service`;
- mantener `supabaseAuth.ts` sólo para sesión/JWT y relayer si todavía aplica;
- actualizar `frontend/src/services/stellar/stellar.network.ts`: USDC contract ID obligatorio y sin fallback a XLM;
- usar `amountMinor` string + decimals para formatear, no `number` decimal de DB;
- mostrar success + explorer sólo para `mode=stellar,status=paid`; mostrar “simulación” sin explorer para mock y estado pendiente mientras RPC no confirme.

No revocar SELECT legacy hasta que el build frontend que usa FastAPI esté verificado. Después aplicar una migration separada que revoque todo y, tras una ventana acordada, dropee tablas demo.

### Gate

```bash
cd /home/jhaycortez/code/f-projects/f-pato_pay/backend
uv run pytest tests/api/test_openapi.py tests/api/test_error_contract.py \
  tests/api/test_request_logging.py tests/api/test_readiness.py -q
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
uv run mypy src

cd ../frontend
npm run typecheck
npm run lint

cd ..
git grep -nE '/(events|wallets|transactions|payment_policies|service_subscriptions)\?' \
  -- frontend/src frontend/app || true
```

Aceptación: el grep no encuentra acceso PostgREST de dominio; Supabase client queda sólo para Auth/relayer.

### Commits

Backend:

```bash
git add backend/src backend/tests docs/backend-domain-api.md
git commit -m "feat: publish authenticated domain API contract"
```

Frontend/cutover, separado:

```bash
git add frontend/src/services frontend/app
# no stagear frontend/.env.example protegido
git commit -m "feat: route domain data through FastAPI"
```

## Fase 14 — Rollout seguro y cierre de RLS demo

### Dependencias

Todo local verde, cutover frontend desplegable, proyecto Cloud enlazado y backup confirmado.

### Predeploy

```bash
cd /home/jhaycortez/code/f-projects/f-pato_pay
npx supabase migration list
npx supabase db push --dry-run
```

Revisar SQL exacto. No usar `--include-seed` ni `db reset` en Cloud. Un solo responsable ejecuta push.

### Orden de rollout

1. backup/snapshot y conteo de tablas legacy;
2. aplicar schema privado + roles sin romper SELECT legacy;
3. provisionar/rotar login runtime fuera de Git;
4. desplegar FastAPI con `PAYMENT_EXECUTOR=mock` en staging;
5. smoke con dos JWTs y read-back exacto;
6. desplegar frontend FastAPI;
7. observar errores;
8. revocar SELECT legacy;
9. cambiar staging a `stellar`, hacer smoke mínimo Testnet;
10. dropear tablas demo sólo en release posterior aprobado.

### Verificación externa obligatoria

```bash
curl --fail "$API_BASE_URL/health"
curl --fail "$API_BASE_URL/ready"
curl -i "$API_BASE_URL/api/v1/me"  # 401 sin token
npx supabase migration list
```

Smoke autenticado debe:

- leer/actualizar perfil;
- registrar dos wallets de test;
- guardar política;
- crear request;
- leer decisión;
- aprobar si corresponde;
- ejecutar mock o Stellar;
- leer transaction por ID y confirmar estado final;
- verificar que user C recibe 404;
- comprobar por SQL que `anon` no puede leer/escribir tablas legacy/core.

Sólo declarar éxito después del GET final y de la lectura de permisos. Un `db push` exitoso por sí solo no alcanza.

### Commit de cierre de acceso demo

Crear la migration posterior:

- `supabase/migrations/20260920000500_remove_legacy_data_api_access.sql`

```bash
git add supabase/migrations/20260920000500_remove_legacy_data_api_access.sql
git commit -m "security: remove legacy anonymous data access"
```

## Fase 15 — Quality gate final y handoff

### Gate local completo

```bash
cd /home/jhaycortez/code/f-projects/f-pato_pay
npx supabase start
npx supabase db reset
npx supabase db reset
npx supabase db lint
npx supabase test db

cd backend
uv sync --frozen
PATOPAY_TEST_DATABASE_URL="$LOCAL_RUNTIME_DATABASE_URL" uv run pytest -q
uv run ruff check .
uv run ruff format --check .
uv run mypy src

git grep -nE 'NotImplementedError|TODO|except Exception|print\(|/home/|postgres(ql)?://|Bearer [A-Za-z0-9_-]+' \
  -- backend/src backend/tests backend/scripts || true

cd ..
git diff --check
git status --short --branch
git log --oneline --decorate -20
```

El scan se revisa, no se “pasa” automáticamente: los adapters HTTP pueden tener clases pequeñas, pero no deben quedar placeholders, broad catches, debug output, paths locales ni secretos.

### Criterios de cierre

- suite unit/API/integration completa verde;
- dos resets, lint y pgTAP verdes;
- OpenAPI coincide con la matriz;
- eventos ya no están en memoria;
- JWT inválido y acceso cruzado cubiertos;
- runtime role sin DDL/BYPASSRLS;
- decisiones append-only e idempotencia verificadas bajo carrera;
- mock mueve saldo una vez;
- Stellar valida intención XDR y reconciliación;
- smoke Testnet real verde antes de llamar “Stellar listo”;
- frontend no usa PostgREST para dominio;
- `anon/authenticated` no acceden tablas de dominio/legacy;
- ningún secret/XDR/JWT en logs o Git;
- `.env.example` preexistentes preservados o integrados con aprobación explícita;
- worktree explicado con exactitud; no afirmar “limpio” si quedan cambios del usuario.

No hacer un commit paraguas de arreglos. Si este gate descubre una falla, volver a RED -> GREEN en un commit enfocado.

---

## Disciplina TDD por cada slice

Para **cada comportamiento**, no por fase completa:

1. escribir un test focalizado;
2. correr su node ID exacto;
3. confirmar RED por conducta faltante;
4. implementar lo mínimo;
5. confirmar GREEN en el node;
6. correr archivo/suite relevante;
7. refactorizar sólo en verde;
8. correr full gate de la fase;
9. revisar staged diff y commit chico.

Si el test pasa de entrada, no cuenta como RED. Si falla por import/fixture/infra, corregir el test hasta obtener la falla esperada. No escribir una batería horizontal enorme antes del primer tracer bullet.

## Matriz mínima de verificación

| Área | Evidencia |
|---|---|
| Auth | missing/expired/wrong issuer/audience/kid -> 401 |
| Identidad | actor/body spoof rechazado |
| Profile | `sub` sólo lee/edita su perfil |
| RLS | B no lee/escribe filas de A |
| Pool | claim de A no aparece en request B |
| Money | string decimal canónica en JSON, value object entero, escala/rango |
| Policy | allowlist, thresholds y daily limit con reason codes |
| Events | persistencia y visibilidad; no memoria |
| Wallet | address única, sin secrets, balance adapter |
| Request | request + decisión inicial atómicas |
| Decision | sólo payer, append-only, optimistic lock |
| Idempotency | same key/same payload replay; different payload 409 |
| Mock | debit/credit/simulation ID una sola vez bajo carrera; sin tx hash/explorer |
| Stellar XDR | contract/from/to/amount/network exactos |
| Stellar timeout | estado incierto reconciliable, no doble submit |
| Transaction | hash única, confirmación por evidencia RPC |
| API | error envelope, bearer OpenAPI, CORS |
| Logs | sin JWT/DSN/key/XDR/PII sensible |
| Cutover | cero lecturas/escrituras PostgREST de dominio |
| Cloud | migration list igual y read-back de smoke |

## Riesgos y mitigaciones

1. **Proyecto Cloud no enlazado/drift desconocido.** Enlazar y hacer pull/list/dry-run antes de cualquier migration remota; no reparar automáticamente.
2. **Cambios protegidos en env examples.** No normalizar valores “a ojo”; preservar literal, stagear hunks exactos o documentar variables en archivo nuevo.
3. **Datos demo quizá ya usados.** Contar/clasificar; no backfill a `auth.users` sin mapping verificable.
4. **Ventana de RLS insegura.** Mantener compatibilidad sólo durante cutover corto y revocar en migration explícita verificada.
5. **Auth anónimo actual del relayer.** Migrar a sesión real por magic link/JWT y ticket one-time antes de habilitar el flujo de dominio; rechazar anónimos en FastAPI.
6. **Wallet claim sin prueba al registrarse.** En v1, validar ownership durante ejecución mediante XDR `from`; diseñar challenge firmado en fase posterior.
7. **“Autopay” no puede firmar solo.** Policy auto-aprueba, pero la passkey sigue requiriendo presencia. No vender autonomía que el signer actual no ofrece.
8. **HTTP + DB no son una transacción.** Usar estados intermedios, idempotencia y reconciliación; nunca asumir rollback on-chain.
9. **Timeout puede haber enviado.** No reintentar a ciegas; consultar por hash/provider ref.
10. **Edge Function valida sólo forma básica hoy.** La Fase 12 valida intención completa en FastAPI y endurece la Edge Function; no activar el relayer antes de que ambos gates estén verdes.
11. **Montos frontend hoy son decimales JS.** Cortar a `amountMinor` string + decimals y formatear en UI; evitar conversiones float.
12. **Daily limit y zona horaria.** V1 usa día UTC, documentado y probado; otra zona requiere cambio explícito de producto.
13. **Dos providers con semántica distinta.** Contract tests compartidos y cero fallback silencioso.
14. **Tests que llaman Cloud.** Suite normal 100% offline/local; smoke hosted/Testnet opt-in y con secrets fuera de output.
15. **Alcance grande.** Cada fase deja una vertical slice usable; no juntar schema, auth, políticas y Stellar en un mega-commit.

## Preguntas que bloquean rollout, no el TDD local

- ¿Las tablas `public.*` contienen sólo demo descartable?
- ¿El proyecto usa signing keys asimétricas o legacy HS256?
- ¿El relayer acepta idempotency key/provider reference para resolver timeout?
- ¿Cuál es el SAC contract ID verificado del USDC Testnet que se habilitará en el registry?
- ¿Quién ejecuta el único `db push` y provisiona el runtime role?
- ¿Cuándo se aprueba mergear los cambios ya presentes en ambos `.env.example`?

Estas preguntas no justifican frenar domain tests, mocks, ports ni schema local. Sí bloquean activar Cloud/Stellar y revocar definitivamente el acceso legacy.

## Referencias técnicas verificadas

- Stellar, smart wallets/contract accounts y passkeys: https://developers.stellar.org/docs/build/guides/contract-accounts/smart-wallets
- Stellar, auth-entry signing para C-accounts, relayer y enforcing simulation: https://developers.stellar.org/docs/build/guides/transactions/signing-soroban-invocations
- Stellar, autorización Soroban y `__check_auth`: https://developers.stellar.org/docs/learn/encyclopedia/security/authorization
- Stellar, advertencia de validar qué transacciones acepta un backend/relayer: https://developers.stellar.org/docs/build/apps/guestbook/setup-passkeys
- Stellar, OpenZeppelin Relayer/Channels: https://developers.stellar.org/docs/tools/openzeppelin-relayer
- Passkey Kit: https://github.com/kalepail/passkey-kit

Principio derivado de estas fuentes: una C-account autoriza una invocación mediante auth entries; un G-account separado paga fees y firma el envelope. Por eso PatoPay puede coordinar y relayer puede patrocinar sin poseer la clave que controla fondos, siempre que valide estrictamente la intención antes de transmitir.