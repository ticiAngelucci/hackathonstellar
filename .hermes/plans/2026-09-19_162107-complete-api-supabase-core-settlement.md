# Plan de implementación: API MVP, Supabase, PatoPay Core y Settlement Engine

## Goal

Entregar un backend MVP autenticado y persistente que permita a compañeros crear eventos, agregar participantes y gastos, finalizar eventos, revisar balances y solicitudes de pago, aprobar/rechazar/disputar cálculos y comprobar todo contra el proyecto Supabase hospedado existente, sin simular pagos x402/Stellar.

## Current context / assumptions

- Repositorio: `/home/jhaycortez/code/f-projects/f-pato_pay`.
- Backend: `/home/jhaycortez/code/f-projects/f-pato_pay/backend`.
- Rama observada al escribir el plan: `main`, commit `33e7ee6b` (`first front commit`), sincronizada con `origin/main`.
- Estado backend actual:
  - `GET /health`.
  - `POST /api/v1/events` y `GET /api/v1/events` sobre `InMemoryEventService`.
  - La identidad del creador todavía viene en el body; esto se eliminará.
  - Quality gate observada: 3 tests, Ruff, formatter y mypy estricto en verde.
- El worktree **no está limpio** por cambios preexistentes en `frontend/node_modules` y `.hermes/` sin seguimiento. Hay 22.058 archivos de `frontend/node_modules` rastreados por Git. El implementador no debe ejecutar `git reset`, `git clean`, `git checkout --`, `git stash` ni sobrescribir estos cambios.
- Supabase Cloud Free:
  - el proyecto administrado `PatoPay` aloja PostgreSQL, Auth y los servicios Supabase;
  - no se instalará ni hospedará Supabase en el VPS;
  - el VPS, si se usa, ejecutará únicamente FastAPI y se conectará al Postgres administrado;
  - se usará Supabase Auth con email magic link y JWT;
  - el frontend solicitará el magic link directamente a Supabase y enviará `Authorization: Bearer <access_token>` a FastAPI;
  - no se agregará un proxy de login a FastAPI.
- La URL/ref, contraseña, claves y tokens del proyecto no están en el repositorio y deben seguir fuera de Git.
- El backend objetivo corre como proceso persistente en VPS. Usar conexión directa si el VPS tiene IPv6; si no, Supavisor **session mode** en puerto 5432. No elegir transaction mode por defecto.
- Para pruebas locales, usar Supabase CLI + Docker sólo como entorno efímero de desarrollo; el entorno compartido y el despliegue usan Supabase Cloud Free. No ejecutar resets destructivos sobre el proyecto Cloud.
- PatoPay Core y Settlement Engine serán módulos del mismo monolito FastAPI y compartirán una transacción PostgreSQL. Separarlos en servicios ahora agregaría fallos distribuidos sin valor para el MVP.
- Dinero:
  - sólo USDC en esta fase;
  - enteros `amount_minor` en todas las capas;
  - `asset_scale = 7` para mantener compatibilidad con el rail Stellar planificado;
  - ejemplo: `14.50 USDC == 145000000` unidades base;
  - quedan prohibidos `float` y montos decimales en JSON.
- Estados del MVP:
  - evento: `draft -> finalized`;
  - settlement revision: `active -> superseded`;
  - payment request: `pending -> approved | rejected | disputed`, y cualquier estado no pagado puede pasar a `superseded` por una revisión nueva;
  - disputa: `open -> upheld | denied`.
- `approved` significa “el deudor acepta el cálculo”; **no** significa pago ejecutado. No crear estados `paid`/`settled`, transaction hashes ni receipts hasta integrar x402/Stellar.
- Alcance funcional:
  - perfil actual;
  - CRUD acotado de eventos en draft;
  - participantes por email;
  - CRUD de gastos en draft con división igual selectiva;
  - finalización atómica;
  - balances, revisiones y transferencias;
  - solicitudes de pago;
  - approve/reject/dispute;
  - resolución de disputa y recálculo con nueva revisión inmutable;
  - idempotencia y control optimista en operaciones mutantes.
- Fuera de alcance:
  - agentes LLM y políticas autónomas;
  - fondos, staking y servicios automáticos;
  - wallets, x402, facilitator y Stellar;
  - comprobantes/Storage;
  - notificaciones push;
  - paginación compleja; se usará `limit` + cursor por `(created_at,id)` sólo en listados principales.

## Architecture / proposed approach

Mantener un monolito modular: FastAPI sólo valida/transfiere HTTP; `application/` contiene casos de uso, permisos y límites transaccionales; `domain/` contiene dinero y settlement puros; `infrastructure/postgres/` implementa repositorios y Unit of Work con SQLAlchemy 2 async; Supabase Postgres persiste y aplica constraints/RLS. La finalización y cada corrección bloquearán el evento, tomarán un snapshot, calcularán balances/transferencias y escribirán revisión + requests en **una sola transacción**.

El frontend hablará con Supabase únicamente para Auth; todo dato de PatoPay pasará por FastAPI. Las tablas vivirán en el schema privado `patopay`, no expuesto por Data API, y el runtime usará un login PostgreSQL separado, sin DDL, ownership ni `BYPASSRLS`; `sub` validado se propagará con `set_config(..., true)` dentro de cada transacción para que RLS sea defensa en profundidad.

## Contrato API objetivo

Todas las rutas salvo `/health`, `/docs`, `/openapi.json` y `/redoc` requieren bearer token válido.

| Método | Endpoint | Éxito | Regla principal |
|---|---|---:|---|
| `GET` | `/api/v1/me` | 200 | Perfil del `sub` validado |
| `PATCH` | `/api/v1/me` | 200 | Cambia sólo `display_name` |
| `POST` | `/api/v1/events` | 201 | Creador derivado del JWT |
| `GET` | `/api/v1/events?limit=20&cursor=` | 200 | Sólo eventos donde participa |
| `GET` | `/api/v1/events/{event_id}` | 200 | Sólo participante |
| `PATCH` | `/api/v1/events/{event_id}` | 200 | Sólo owner, sólo draft, `expected_version` |
| `POST` | `/api/v1/events/{event_id}/participants` | 201 | Sólo owner, email registrado, sólo draft |
| `DELETE` | `/api/v1/events/{event_id}/participants/{user_id}` | 204 | Sólo owner, no owner/referenciado, sólo draft |
| `POST` | `/api/v1/events/{event_id}/expenses` | 201 | Owner o pagador; beneficiarios del evento |
| `GET` | `/api/v1/events/{event_id}/expenses` | 200 | Sólo participante |
| `GET` | `/api/v1/events/{event_id}/expenses/{expense_id}` | 200 | Sólo participante |
| `PATCH` | `/api/v1/events/{event_id}/expenses/{expense_id}` | 200 | Sólo draft, `expected_version` |
| `DELETE` | `/api/v1/events/{event_id}/expenses/{expense_id}` | 204 | Soft-delete sólo en draft |
| `POST` | `/api/v1/events/{event_id}/finalize` | 201 | Sólo owner, idempotente, al menos 2 participantes y 1 gasto |
| `GET` | `/api/v1/events/{event_id}/balances?revision=` | 200 | Revisión activa por defecto |
| `GET` | `/api/v1/events/{event_id}/settlement-revisions` | 200 | Historial visible a participantes |
| `GET` | `/api/v1/events/{event_id}/settlement-revisions/{revision_no}` | 200 | Snapshot, balances y transfers |
| `GET` | `/api/v1/payment-requests?status=&direction=` | 200 | Requests donde el usuario es deudor o acreedor |
| `GET` | `/api/v1/payment-requests/{request_id}` | 200 | Sólo deudor/acreedor/owner |
| `POST` | `/api/v1/payment-requests/{request_id}/approve` | 200 | Sólo deudor, sólo pending |
| `POST` | `/api/v1/payment-requests/{request_id}/reject` | 200 | Sólo deudor, sólo pending, razón requerida |
| `POST` | `/api/v1/payment-requests/{request_id}/disputes` | 201 | Sólo deudor, gasto de la revisión, propuesta estructurada |
| `GET` | `/api/v1/events/{event_id}/disputes` | 200 | Participantes; owner ve todas |
| `POST` | `/api/v1/disputes/{dispute_id}/resolve` | 200 | Sólo owner; upheld recalcula, denied devuelve request a pending |

Semántica uniforme:

- `401`: bearer ausente/inválido/expirado.
- `403`: autenticado sin permiso.
- `404`: inexistente o no visible; no filtrar existencia de recursos ajenos.
- `409`: transición inválida, versión obsoleta, duplicado o misma idempotency key con payload distinto.
- `422`: shape o invariantes de entrada inválidas.
- Mutaciones críticas aceptan `Idempotency-Key`: crear evento/gasto, agregar participante, finalizar, decidir, disputar y resolver.

## Modelo persistente objetivo

Crear todo en schema `patopay`:

| Tabla | Campos esenciales / constraints |
|---|---|
| `profiles` | `id uuid PK -> auth.users`, `email citext UNIQUE`, `display_name`, timestamps |
| `events` | UUID PK, owner, name, `asset_code='USDC'`, `asset_scale=7`, status, version, timestamps, finalized_at |
| `event_participants` | PK `(event_id,user_id)`, role owner/member, joined_at |
| `expenses` | UUID PK, event, description, `amount_minor bigint`, paid_by, created_by, version, deleted_at, timestamps |
| `expense_splits` | PK `(expense_id,user_id)`, `owed_minor bigint`, deterministic rank |
| `settlement_revisions` | UUID PK, event, unique revision_no, status, reason, input_digest, created_by, created_at |
| `settlement_balances` | PK `(settlement_revision_id,user_id)`, paid/owed/net minor |
| `settlement_transfers` | UUID PK, revision, from/to, amount, transfer_order, unique revision+order |
| `payment_requests` | UUID PK, transfer UNIQUE, immutable amount/actors, status, version, timestamps |
| `payment_request_decisions` | append-only actor/action/reason/created_at |
| `disputes` | request, expense, opened_by, reason, proposed participant UUID array, status, resolution, timestamps |
| `expense_corrections` | append-only dispute, expense, before/after JSONB, applied_by, applied_at |
| `idempotency_keys` | PK actor+method+path+key, request_hash, status_code, response JSONB, created_at |

No cascadear borrado de `auth.users` hacia historia financiera. El trigger de Auth debe crear `profiles`; una eliminación posterior de usuario debe anonimizarse en una fase futura. En esta fase usar `ON DELETE RESTRICT` para perfiles ya referenciados y documentar que el Dashboard no debe borrar testers con actividad.

## Step-by-step tasks

### Task 0 — Preflight, preservar cambios y sanear dependencias rastreadas

#### 0.1 Inspección obligatoria

Desde la raíz:

```bash
cd /home/jhaycortez/code/f-projects/f-pato_pay
git status --porcelain=v1 --branch
git log --oneline --decorate -8
git diff --name-only
git diff --cached --name-only
git ls-files frontend/node_modules | wc -l
```

Esperado inicialmente: `main`, cinco cambios bajo `frontend/node_modules`, `.hermes/` sin seguimiento, `22058` archivos de `node_modules` en el índice. Si difiere, preservar lo nuevo y actualizar este plan antes de tocarlo.

#### 0.2 Commit aislado de higiene

Primero confirmar con el propietario que los cambios de `frontend/node_modules` son sólo instalación local. Sin borrar el directorio de trabajo:

```bash
printf '\nnode_modules/\n.expo/\n' >> .gitignore
git rm -r --cached frontend/node_modules
npm ci --prefix frontend
npm run lint --prefix frontend
git add .gitignore frontend/package.json frontend/package-lock.json
git diff --cached --check
git commit -m "chore: stop tracking frontend dependencies"
```

Esperado: `frontend/node_modules` deja de estar rastreado, continúa disponible localmente y lint termina con código 0. No agregar `.hermes/` al commit.

> Si el usuario no autoriza limpiar esos archivos, crear una rama/worktree aislada y no continuar en un árbol donde los diffs generados ocultan cambios reales.

### Task 1 — Fijar dependencias y configuración sin secretos

#### 1.1 RED: tests de Settings

Crear `backend/tests/test_config.py` con casos que exijan:

```python
from patopay.config import Settings


def test_settings_require_runtime_integrations_in_non_test_environment() -> None:
    settings = Settings(
        env="test",
        database_url="postgresql+psycopg://postgres:postgres@127.0.0.1:54322/postgres",
        supabase_url="http://127.0.0.1:54321",
        supabase_publishable_key="test-key",
    )
    assert settings.database_url.startswith("postgresql+psycopg://")
    assert settings.supabase_issuer == "http://127.0.0.1:54321/auth/v1"
```

Ejecutar:

```bash
cd backend
uv run pytest tests/test_config.py -q
```

RED esperado: campos inexistentes o validación ausente.

#### 1.2 GREEN: configuración y dependencias

Agregar con `uv add`:

```bash
uv add 'sqlalchemy[asyncio]>=2.0,<2.1' 'psycopg[binary]>=3.2,<4' 'pyjwt[crypto]>=2.10,<3'
```

Actualizar `backend/src/patopay/config.py` con campos explícitos:

```python
from functools import cached_property
from typing import Literal

from pydantic import AnyHttpUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="PATOPAY_",
        extra="ignore",
    )

    env: Literal["local", "test", "staging", "production"] = "local"
    app_name: str = "PatoPay API"
    app_version: str = "0.2.0"
    api_prefix: str = "/api/v1"
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:8081"])
    database_url: str
    supabase_url: AnyHttpUrl
    supabase_publishable_key: str
    db_pool_size: int = Field(default=5, ge=1, le=20)
    db_max_overflow: int = Field(default=5, ge=0, le=20)

    @cached_property
    def supabase_issuer(self) -> str:
        return f"{str(self.supabase_url).rstrip('/')}/auth/v1"
```

Crear `backend/.env.example` sin valores reales:

```dotenv
PATOPAY_ENV=local
PATOPAY_DATABASE_URL=postgresql+psycopg://postgres:postgres@127.0.0.1:54322/postgres
PATOPAY_SUPABASE_URL=http://127.0.0.1:54321
PATOPAY_SUPABASE_PUBLISHABLE_KEY=replace-me
PATOPAY_CORS_ORIGINS=["http://localhost:8081"]
```

Asegurar que `.env`, `.env.*`, certificados, `supabase/.temp/` y `supabase/.branches/` estén ignorados, manteniendo `.env.example` permitido.

Verificar y commitear:

```bash
uv run pytest tests/test_config.py -q
uv run ruff check .
uv run ruff format --check .
uv run mypy src
git add backend/pyproject.toml backend/uv.lock backend/.env.example backend/src/patopay/config.py backend/tests/test_config.py .gitignore
git commit -m "chore: configure database and Supabase integrations"
```

### Task 2 — Money y división igual determinista (RED → GREEN → REFACTOR)

#### 2.1 RED

Crear `backend/tests/unit/domain/test_money.py` que cubra:

- 100 entre 3 UUIDs => `34,33,33` en orden UUID;
- orden de input distinto produce igual mapping;
- total exacto;
- monto `<= 0`, lista vacía y UUID duplicado fallan;
- `bool` no es aceptado como int;
- máximo `9_000_000_000_000_000`.

Ejecutar:

```bash
uv run pytest tests/unit/domain/test_money.py -q
```

RED esperado: `ModuleNotFoundError: patopay.domain.money`.

#### 2.2 GREEN

Crear `backend/src/patopay/domain/money.py`:

```python
from dataclasses import dataclass
from uuid import UUID

MAX_AMOUNT_MINOR = 9_000_000_000_000_000


class MoneyInvariantError(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class Share:
    user_id: UUID
    owed_minor: int
    rank: int


def split_equally(amount_minor: int, user_ids: list[UUID]) -> list[Share]:
    if isinstance(amount_minor, bool) or not 0 < amount_minor <= MAX_AMOUNT_MINOR:
        raise MoneyInvariantError("amount_minor must be a positive bounded integer")
    ordered = sorted(user_ids, key=str)
    if not ordered or len(set(ordered)) != len(ordered):
        raise MoneyInvariantError("beneficiaries must be non-empty and unique")
    quotient, remainder = divmod(amount_minor, len(ordered))
    return [
        Share(
            user_id=user_id,
            owed_minor=quotient + (1 if rank < remainder else 0),
            rank=rank,
        )
        for rank, user_id in enumerate(ordered)
    ]
```

Verificar:

```bash
uv run pytest tests/unit/domain/test_money.py -q
uv run ruff check src/patopay/domain tests/unit/domain
uv run ruff format --check src/patopay/domain tests/unit/domain
uv run mypy src
git add backend/src/patopay/domain/money.py backend/tests/unit/domain/test_money.py
git commit -m "feat: add deterministic equal expense splitting"
```

### Task 3 — Settlement Engine puro (RED → GREEN → REFACTOR)

#### 3.1 RED

Crear `backend/tests/unit/domain/test_settlement.py` con:

1. ejemplo README: pagos 70/30, cuatro shares de 25 => balances `+45,+5,-25,-25` y 3 transferencias;
2. gasto con beneficiarios selectivos;
3. balances ya en cero => transferencias vacías;
4. mismo snapshot desordenado => resultado idéntico;
5. invariantes `sum(net_minor) == 0`, sin self-transfer, importes positivos;
6. por usuario `incoming - outgoing == net_minor`;
7. rechazo si un split no suma el gasto.

Ejecutar y confirmar RED por módulo faltante.

#### 3.2 GREEN

Crear `backend/src/patopay/domain/settlement.py`:

```python
from dataclasses import dataclass
from uuid import UUID

from patopay.domain.money import MoneyInvariantError


@dataclass(frozen=True, slots=True)
class ExpenseSnapshot:
    expense_id: UUID
    paid_by: UUID
    amount_minor: int
    shares: dict[UUID, int]


@dataclass(frozen=True, slots=True)
class Balance:
    user_id: UUID
    paid_minor: int
    owed_minor: int
    net_minor: int


@dataclass(frozen=True, slots=True)
class Transfer:
    from_user_id: UUID
    to_user_id: UUID
    amount_minor: int
    order: int


@dataclass(frozen=True, slots=True)
class SettlementResult:
    balances: tuple[Balance, ...]
    transfers: tuple[Transfer, ...]


def calculate_settlement(
    participant_ids: list[UUID],
    expenses: list[ExpenseSnapshot],
) -> SettlementResult:
    ordered_users = sorted(set(participant_ids), key=str)
    if len(ordered_users) != len(participant_ids):
        raise MoneyInvariantError("participants must be unique")
    paid = {user_id: 0 for user_id in ordered_users}
    owed = {user_id: 0 for user_id in ordered_users}
    for expense in expenses:
        if expense.paid_by not in paid or set(expense.shares) - set(paid):
            raise MoneyInvariantError("expense references a non-participant")
        if sum(expense.shares.values()) != expense.amount_minor:
            raise MoneyInvariantError("expense shares must sum to amount")
        paid[expense.paid_by] += expense.amount_minor
        for user_id, amount_minor in expense.shares.items():
            if amount_minor < 0:
                raise MoneyInvariantError("share cannot be negative")
            owed[user_id] += amount_minor

    balances = tuple(
        Balance(user_id, paid[user_id], owed[user_id], paid[user_id] - owed[user_id])
        for user_id in ordered_users
    )
    if sum(item.net_minor for item in balances) != 0:
        raise MoneyInvariantError("settlement is not balanced")

    debtors = [[item.user_id, -item.net_minor] for item in balances if item.net_minor < 0]
    creditors = [[item.user_id, item.net_minor] for item in balances if item.net_minor > 0]
    debtors.sort(key=lambda item: (-int(item[1]), str(item[0])))
    creditors.sort(key=lambda item: (-int(item[1]), str(item[0])))
    transfers: list[Transfer] = []
    debtor_index = creditor_index = 0
    while debtor_index < len(debtors) and creditor_index < len(creditors):
        debtor_id, debt = debtors[debtor_index]
        creditor_id, credit = creditors[creditor_index]
        amount = min(int(debt), int(credit))
        transfers.append(Transfer(debtor_id, creditor_id, amount, len(transfers)))
        debtors[debtor_index][1] = int(debt) - amount
        creditors[creditor_index][1] = int(credit) - amount
        if debtors[debtor_index][1] == 0:
            debtor_index += 1
        if creditors[creditor_index][1] == 0:
            creditor_index += 1
    return SettlementResult(balances=balances, transfers=tuple(transfers))
```

El algoritmo es determinista y elimina ciclos, pero no afirmar que encuentra el mínimo global de transferencias.

Verificar y commitear:

```bash
uv run pytest tests/unit/domain/test_settlement.py -q
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
uv run mypy src
git add backend/src/patopay/domain/settlement.py backend/tests/unit/domain/test_settlement.py
git commit -m "feat: add deterministic settlement engine"
```

### Task 4 — Adoptar el proyecto Supabase hospedado y fijar migrations

Esta tarea requiere interacción segura. No escribir project ref, password ni access token en el plan, shell history compartido o Git.

#### 4.1 Tooling reproducible

Desde raíz:

```bash
npm install --save-dev --save-exact supabase
npx supabase --version
npx supabase init
```

Commit sólo `package.json`/lock de raíz y `supabase/config.toml`. Si no existe package de raíz, `npm init -y` primero y marcarlo `private: true`.

#### 4.2 Baseline remoto antes de crear tablas

Con backup/snapshot confirmado y secrets exportados mediante el vault del equipo:

```bash
npx supabase login
npx supabase link --project-ref "$SUPABASE_PROJECT_REF"
npx supabase db pull baseline_remote
npx supabase migration list
npx supabase db push --dry-run
```

Esperado: un archivo `supabase/migrations/<timestamp>_baseline_remote.sql`; el dry-run no debe proponer re-crear objetos remotos ya existentes. Si propone cambios inexplicables, detenerse; no usar `migration repair` automáticamente.

#### 4.3 RED database tests

Crear `supabase/tests/database/001_schema.test.sql` con pgTAP para exigir:

- schema `patopay`;
- las 12 tablas listadas arriba;
- FKs/unique/checks;
- RLS habilitado y forzado en todas;
- `anon` y `authenticated` sin privilegios directos sobre `patopay`;
- `patopay_runtime` sin `BYPASSRLS` ni DDL.

Ejecutar:

```bash
npx supabase start
npx supabase test db
```

RED esperado: objetos faltantes.

#### 4.4 GREEN migration de schema

Crear con:

```bash
npx supabase migration new patopay_mvp_schema
```

En el SQL generado:

- `create extension if not exists citext with schema extensions;`
- `create schema patopay;`
- enums o checks de estados exactos;
- tablas/índices/constraints del modelo objetivo;
- partial unique index para una sola revisión activa por evento;
- índices por membership, event, debtor, creditor y status;
- `create role patopay_runtime nologin noinherit nobypassrls;` sólo si no existe;
- grants `USAGE` y DML mínimos al rol runtime;
- revoke all a `anon`, `authenticated`, `public`;
- RLS + `FORCE ROW LEVEL SECURITY`;
- funciones helper con `SECURITY DEFINER SET search_path = ''`, nombres cualificados y `REVOKE EXECUTE FROM PUBLIC`;
- trigger `auth.users -> patopay.profiles`, copiando email y `raw_user_meta_data->>'display_name'`, sin confiar en metadata para roles/permisos.

Constraints mínimas obligatorias:

```sql
check (amount_minor > 0 and amount_minor <= 9000000000000000)
check (asset_code = 'USDC')
check (asset_scale = 7)
check (from_user_id <> to_user_id)
unique (event_id, revision_no)
unique (settlement_revision_id, transfer_order)
unique (settlement_transfer_id)
unique (actor_id, method, path, key)
```

La función de identidad RLS debe usar:

```sql
create function patopay.current_user_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
```

No incluir passwords en migrations.

#### 4.5 Reproducir desde cero

```bash
npx supabase db reset
npx supabase db lint
npx supabase test db
npx supabase db push --dry-run
```

Esperado: reset/lint/tests en código 0; dry-run muestra únicamente la nueva migration pendiente. Commit:

```bash
git add package.json package-lock.json supabase/
git commit -m "feat: define Supabase MVP schema"
```

### Task 5 — Rol runtime separado y conexión SQLAlchemy

#### 5.1 Provisionar login sin guardar password

Crear `supabase/scripts/provision_runtime_role.sql`:

```sql
\set ON_ERROR_STOP on
select 'create role patopay_api login in role patopay_runtime'
where not exists (select 1 from pg_roles where rolname = 'patopay_api')
\gexec
select format('alter role patopay_api password %L', :'runtime_password')
\gexec
alter role patopay_api set search_path = patopay, public;
```

Ejecutarlo sólo en local/staging con secretos de vault:

```bash
psql "$ADMIN_DATABASE_URL" \
  --set runtime_password="$PATOPAY_RUNTIME_DB_PASSWORD" \
  --file supabase/scripts/provision_runtime_role.sql
```

Verificar vía SQL que `patopay_api` no es superuser, no tiene bypass RLS y no puede `CREATE TABLE`/`ALTER TABLE`. La URL runtime debe usar este login; nunca `postgres` o service-role.

#### 5.2 RED: integración de Unit of Work

Crear:

- `backend/tests/integration/conftest.py` con `PATOPAY_TEST_DATABASE_URL` obligatorio para tests marcados `integration`;
- `backend/tests/integration/test_database.py` que abra UoW, compruebe `select patopay.current_user_id()`, rollback y aislamiento entre dos UUIDs.

Ejecutar:

```bash
PATOPAY_TEST_DATABASE_URL='postgresql+psycopg://patopay_api:...@127.0.0.1:54322/postgres' \
  uv run pytest -m integration tests/integration/test_database.py -q
```

RED esperado: infraestructura faltante.

#### 5.3 GREEN

Crear:

- `backend/src/patopay/infrastructure/postgres/database.py`: `create_async_engine`, `pool_pre_ping=True`, pool/timeouts, SSL configurable; `async_sessionmaker(expire_on_commit=False)`.
- `backend/src/patopay/application/ports/unit_of_work.py`: protocolo async con repositorios y `commit`/`rollback`.
- `backend/src/patopay/infrastructure/postgres/unit_of_work.py`: al entrar inicia transacción y ejecuta:

```python
await session.execute(
    text("select set_config('request.jwt.claim.sub', :subject, true)"),
    {"subject": str(subject)},
)
```

El tercer argumento `true` es obligatorio para que el claim no se filtre a otra request del pool.

- `backend/src/patopay/infrastructure/postgres/models.py`: mappings SQLAlchemy que reflejan exactamente migrations; ningún `create_all()` en runtime.
- lifespan en `backend/src/patopay/main.py` para crear/disponer engine.

Verificar integración + gate y commit:

```bash
uv run pytest -m integration tests/integration/test_database.py -q
uv run pytest -m 'not integration' -q
uv run ruff check .
uv run ruff format --check .
uv run mypy src
git commit -am "feat: add transactional PostgreSQL unit of work"
```

### Task 6 — Validar JWT y exponer perfil actual

#### 6.1 RED

Crear `backend/tests/unit/application/test_auth.py` y `backend/tests/api/test_me_api.py`:

- sin header -> 401;
- esquema no Bearer -> 401;
- token inválido/expirado/issuer o audience incorrectos -> 401;
- token válido -> current user con UUID del `sub`;
- `GET /me` devuelve perfil y `PATCH /me` sólo cambia display name;
- ningún body puede suplantar otro user ID.

Para tests usar un `TokenVerifier` fake; no hacer red.

#### 6.2 GREEN

Crear:

- `backend/src/patopay/application/ports/auth.py`:

```python
@dataclass(frozen=True, slots=True)
class AuthenticatedUser:
    id: UUID
    email: str


class TokenVerifier(Protocol):
    async def verify(self, token: str) -> AuthenticatedUser: ...
```

- `backend/src/patopay/infrastructure/supabase/auth.py`: verificar firma JWT mediante JWKS `${issuer}/.well-known/jwks.json`, permitir sólo `ES256`/`RS256`, validar `iss`, `aud='authenticated'`, `exp`, `sub`, `role='authenticated'`, cachear JWKS y refrescar una vez ante `kid` desconocido.
- Antes de activar validación local, confirmar en Supabase Dashboard que el proyecto usa signing keys asimétricas. Si aún usa HS256 legado, usar temporalmente `supabase.auth.get_user(jwt)`/`GET /auth/v1/user` server-side y abrir una tarea explícita de migración; **no** guardar el JWT secret en FastAPI.
- `backend/src/patopay/api/dependencies.py`: `HTTPBearer(auto_error=False)`, current user y UoW factory.
- `backend/src/patopay/application/use_cases/profiles.py`.
- `backend/src/patopay/api/schemas/profiles.py`.
- `backend/src/patopay/api/routes/profiles.py`.
- traducción central de errores en `backend/src/patopay/api/errors.py` con envelope:

```json
{"error":{"code":"unauthorized","message":"Authentication required","details":null}}
```

Verificar y commit:

```bash
uv run pytest tests/unit/application/test_auth.py tests/api/test_me_api.py -q
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
uv run mypy src
git add backend/src backend/tests
 git commit -m "feat: authenticate requests with Supabase JWT"
```

### Task 7 — Migrar eventos de memoria a PostgreSQL autenticado

#### 7.1 RED

Reemplazar `backend/tests/test_events_api.py` por `backend/tests/api/test_events_api.py` con app/UoW de integración y tokens fake. Probar:

- crear usa `sub`, aunque body intente enviar creator (campo extra => 422);
- owner se agrega como participante atómicamente;
- listar sólo eventos del usuario;
- get ajeno => 404;
- patch owner draft + version correcta;
- patch member => 403;
- version obsoleta => 409;
- persistencia tras crear una segunda app/session.

Ejecutar y confirmar RED.

#### 7.2 GREEN

Separar el viejo `api/schemas.py` en `backend/src/patopay/api/schemas/events.py`. Request de creación exacta:

```json
{"name":"Asado viernes"}
```

Response incluye `id`, `name`, `owner_id`, `status`, `asset_code`, `asset_scale`, `version`, timestamps y participants. Implementar:

- `application/ports/repositories.py` con `EventRepository`;
- `application/use_cases/events.py`;
- `infrastructure/postgres/repositories/events.py`;
- rutas target de evento;
- cursor base64url opaco de `(created_at,id)` y `limit` 1..100;
- idempotency service para POST;
- borrar `InMemoryEventService`, viejo `EventService` y tests de memoria sólo después de que los nuevos tests estén verdes.

Verificar que no queden imports:

```bash
rg 'InMemoryEventService|class EventService|creator.*ParticipantInput' backend/src backend/tests || true
```

Gate + commit:

```bash
uv run pytest tests/api/test_events_api.py -q
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
uv run mypy src
git commit -am "feat: persist authenticated events in Supabase"
```

### Task 8 — Participantes por email

#### 8.1 RED

Crear `backend/tests/api/test_participants_api.py`:

- owner agrega email existente -> 201;
- email desconocido -> 404;
- duplicado -> 409;
- member no puede agregar/eliminar -> 403;
- owner no se puede eliminar;
- sólo draft;
- no eliminar participante referenciado por gasto -> 409;
- transacción revierte ante fallo.

#### 8.2 GREEN

Crear:

- `api/schemas/participants.py` (`email: EmailStr`; agregar dependencia `email-validator` si Pydantic la requiere);
- `application/use_cases/participants.py`;
- métodos de profile/event repository;
- rutas bajo `events.py` o `routes/participants.py`.

Normalizar email con `citext`, no con `.lower()` como única garantía. Nunca buscar en `auth.users` desde la app; usar `patopay.profiles` creado por trigger.

Gate y commit:

```bash
uv run pytest tests/api/test_participants_api.py -q
uv run pytest -q && uv run ruff check . && uv run ruff format --check . && uv run mypy src
git commit -am "feat: manage event participants"
```

### Task 9 — Gastos y splits selectivos persistidos

#### 9.1 RED

Crear:

- `backend/tests/unit/application/test_expenses.py`;
- `backend/tests/api/test_expenses_api.py`;
- `backend/tests/integration/test_expense_repository.py`.

Casos:

- request `{description, amount_minor, paid_by_user_id, participant_ids}`;
- splits iguales persistidos y suman amount;
- pagador puede no estar en beneficiarios;
- pagador/beneficiarios deben pertenecer al evento;
- beneficiarios no vacíos/sin duplicados;
- owner registra gasto de cualquiera; member sólo si él paga;
- PATCH recalcula splits y aumenta version;
- stale version -> 409;
- DELETE marca `deleted_at`, sólo draft;
- finalizado -> 409;
- list/get no devuelve soft-deleted.

#### 9.2 GREEN

Crear:

- `api/schemas/expenses.py` con `StrictInt`, límites y `extra='forbid'`;
- `application/use_cases/expenses.py` invocando `split_equally`;
- `infrastructure/postgres/repositories/expenses.py`;
- `api/routes/expenses.py`.

No calcular shares en responses; leer `expense_splits` persistidos. No aceptar `currency`, decimales ni shares arbitrarios en esta fase.

Gate + commit:

```bash
uv run pytest tests/unit/application/test_expenses.py tests/api/test_expenses_api.py tests/integration/test_expense_repository.py -q
uv run pytest -q && uv run ruff check . && uv run ruff format --check . && uv run mypy src
git commit -am "feat: persist shared event expenses"
```

### Task 10 — Finalización transaccional y revisiones de settlement

#### 10.1 RED

Crear `backend/tests/integration/test_finalize_event.py` y `backend/tests/api/test_settlements_api.py`:

- sólo owner;
- mínimo 2 participantes y 1 gasto;
- bloquea `events` con `SELECT ... FOR UPDATE`;
- genera revisión 1, balances, transfers y un request por transfer;
- snapshot/input digest estable;
- mismo `Idempotency-Key` + mismo body devuelve misma respuesta;
- misma key + payload distinto => 409;
- dos finalizaciones concurrentes no crean dos revisiones;
- fallo al insertar request revierte evento/revisión/balances/transfers;
- lecturas sólo para participantes;
- sum(net)=0 y transfer reconciliation.

#### 10.2 GREEN

Crear:

- `application/use_cases/finalize_event.py`;
- `application/services/settlement_service.py` como orquestador del dominio puro;
- repositories de revisions/balances/transfers/requests;
- `api/schemas/settlements.py` y `api/routes/settlements.py`.

Secuencia dentro de una UoW:

1. lock event;
2. validar owner/status/precondiciones;
3. cargar participantes + gastos + splits activos;
4. canonicalizar snapshot JSON y SHA-256;
5. ejecutar `calculate_settlement`;
6. insertar revision activa #1;
7. insertar balances/transfers;
8. crear request `pending` por transfer;
9. marcar evento finalized;
10. guardar respuesta idempotente;
11. commit.

El response de finalize devuelve revision completa; no ejecuta pagos.

Gate + commit:

```bash
uv run pytest tests/integration/test_finalize_event.py tests/api/test_settlements_api.py -q
uv run pytest -q && uv run ruff check . && uv run ruff format --check . && uv run mypy src
git commit -am "feat: finalize events into settlement revisions"
```

### Task 11 — Payment requests y decisiones append-only

#### 11.1 RED

Crear `backend/tests/api/test_payment_requests_api.py`:

- list por `direction=outgoing|incoming` y status;
- actor no relacionado => 404;
- sólo deudor decide;
- pending -> approved/rejected;
- razón obligatoria para reject;
- segunda decisión incompatible => 409;
- decision append-only;
- aprobar no genera `paid`, hash ni receipt;
- idempotency funciona.

#### 11.2 GREEN

Crear:

- `application/use_cases/payment_requests.py`;
- `api/schemas/payment_requests.py`;
- `api/routes/payment_requests.py`;
- repository con update optimista `WHERE version=:expected AND status='pending'`.

Gate + commit:

```bash
uv run pytest tests/api/test_payment_requests_api.py -q
uv run pytest -q && uv run ruff check . && uv run ruff format --check . && uv run mypy src
git commit -am "feat: review settlement payment requests"
```

### Task 12 — Disputas, correcciones y revisionado inmutable

#### 12.1 RED

Crear `backend/tests/integration/test_dispute_resolution.py` y API tests:

- sólo deudor abre disputa sobre su request;
- gasto debe pertenecer al snapshot/revisión;
- proposal: lista opcional de participant IDs + reason;
- request pending -> disputed;
- sólo owner resuelve;
- deny: disputa denied, decisión append-only, request vuelve a pending;
- uphold: registra before/after, supersede revision/request anteriores, recalcula revision N+1;
- historial anterior no cambia;
- revision N+1 usa roster válido y split exacto;
- fallo a mitad revierte todo;
- dos resoluciones concurrentes sólo producen una N+1.

#### 12.2 GREEN

Crear:

- `application/use_cases/disputes.py`;
- `api/schemas/disputes.py`;
- `api/routes/disputes.py`;
- repositories correspondientes.

Para `uphold`, el owner debe enviar explícitamente `corrected_participant_ids`; no permitir editar manualmente balance, transfer o amount de request. Registrar JSON before/after en `expense_corrections`, reemplazar splits activos del gasto y recalcular todo el settlement en la misma transacción. Mantener evento `finalized`.

Gate + commit:

```bash
uv run pytest tests/integration/test_dispute_resolution.py tests/api/test_disputes_api.py -q
uv run pytest -q && uv run ruff check . && uv run ruff format --check . && uv run mypy src
git commit -am "feat: recalculate settlements from resolved disputes"
```

### Task 13 — Contract/OpenAPI, readiness y observabilidad mínima

#### 13.1 RED

Crear tests que exijan:

- OpenAPI contiene exactamente el endpoint matrix objetivo;
- todos los endpoints privados declaran bearer auth;
- error envelope uniforme;
- request ID en responses/logs;
- `/health` sólo liveness y no toca DB;
- `/ready` ejecuta `select 1` con timeout y devuelve 503 si DB/Auth config no está lista;
- logs nunca incluyen bearer token, DSN, publishable key ni magic-link URL.

#### 13.2 GREEN

Crear:

- `api/routes/readiness.py`;
- middleware de request ID y logging estructurado;
- tags/descriptions/examples en schemas;
- `backend/openapi.json` generado y versionado sólo si el frontend lo consumirá; si no, verificar sin versionarlo.

Comando de contrato:

```bash
uv run python -c "from patopay.main import app; import json; print(json.dumps(sorted(app.openapi()['paths']), indent=2))"
```

Gate + commit:

```bash
uv run pytest tests/api/test_openapi.py tests/api/test_readiness.py -q
uv run pytest -q && uv run ruff check . && uv run ruff format --check . && uv run mypy src
git commit -am "feat: finalize MVP API contract and readiness"
```

### Task 14 — Seed local, Auth magic link y runbook del equipo

#### 14.1 Seed reproducible local

Crear `supabase/seed.sql` sólo con datos ficticios e idempotentes. Los UUIDs deben ser deterministas. Se permiten usuarios placeholder no logueables para relaciones de demo; testers reales se crean pidiendo magic link al stack local/hosted y el trigger crea su profile.

Verificar:

```bash
npx supabase db reset
npx supabase db reset
```

Ambas ejecuciones deben terminar en código 0, sin duplicados.

#### 14.2 Configurar Auth hospedado

En Dashboard del proyecto staging/dev:

- email provider/magic link habilitado;
- Site URL correcta;
- redirects exactos para Expo web/dev y deep link móvil;
- no wildcard `**` en producción;
- signing key asimétrica activa;
- rate limits/email provider suficientes para el equipo.

Registrar valores no secretos (URLs permitidas, project ref) en `docs/mvp-backend-runbook.md`; no capturar tokens ni enlaces enviados por correo.

#### 14.3 Runbook copy-pasteable

Crear `docs/mvp-backend-runbook.md` con:

```bash
npm ci
npx supabase start
npx supabase db reset
cd backend
uv sync --frozen
cp .env.example .env
uv run uvicorn patopay.main:app --reload
```

Documentar cómo:

1. pedir magic link desde el frontend/Supabase client;
2. copiar sólo el access token temporal al Authorize de `/docs`;
3. crear dos usuarios/perfiles;
4. owner crea evento y agrega al segundo por email;
5. crea un gasto `145000000` USDC base units;
6. finaliza;
7. deudor lista y aprueba/disputa request;
8. owner resuelve;
9. ambos observan la revisión nueva.

Añadir ejemplos curl usando `$TOKEN`, nunca tokens literales.

Gate + commit:

```bash
npx supabase db reset
npx supabase db lint
npx supabase test db
cd backend
uv run pytest -q && uv run ruff check . && uv run ruff format --check . && uv run mypy src
cd ..
git add supabase/seed.sql docs/mvp-backend-runbook.md backend/README.md
git commit -m "docs: add reproducible MVP team runbook"
```

### Task 15 — Rollout al Supabase hospedado y smoke test real

Esta tarea sí cambia estado externo y requiere aprobación explícita en ejecución.

#### 15.1 Predeploy

- confirmar que el proyecto es staging/dev o que existe backup válido;
- confirmar migration list local/remoto;
- confirmar que ningún compañero está aplicando migrations simultáneamente;
- comprobar VPS IPv6:

```bash
curl -6 --fail https://ifconfig.co/ip
```

Si falla, usar Session Pooler 5432. Obtener DSN desde Dashboard `Connect`; runtime con `patopay_api`, migraciones con credencial admin. TLS obligatorio.

#### 15.2 Aplicar y leer después

```bash
npx supabase db push --dry-run
npx supabase db push
npx supabase migration list
```

Esperado: dry-run sólo migrations revisadas; push exitoso; lista local/remota coincide. Provisionar/rotar password del runtime role fuera de Git y guardar DSN en secret manager/VPS `EnvironmentFile` modo `0600`.

No ejecutar `--include-seed` contra producción. Para staging demo, hacerlo sólo con aprobación y datos ficticios.

#### 15.3 Deploy backend y verify exact target

Configurar variables `PATOPAY_*`, arrancar backend fijado al commit y verificar:

```bash
curl --fail "$API_BASE_URL/health"
curl --fail "$API_BASE_URL/ready"
curl -i "$API_BASE_URL/api/v1/me"
```

Esperado: health/ready 200, `/me` sin token 401.

Crear `backend/scripts/smoke_hosted.py` que reciba `PATOPAY_SMOKE_OWNER_TOKEN`, `PATOPAY_SMOKE_MEMBER_TOKEN` y `API_BASE_URL`; debe crear evento único, participante, gasto, finalizar, aprobar y leer revisión. Nunca imprimir tokens. Al terminar imprime IDs y status codes para auditoría; no borra datos históricos.

Ejecutar y verificar lectura posterior de los IDs creados:

```bash
uv run python scripts/smoke_hosted.py
```

Sólo declarar éxito si el GET final confirma la revisión activa y el request aprobado.

Commit del script antes del deploy:

```bash
git add backend/scripts/smoke_hosted.py backend/tests/test_smoke_script.py
git commit -m "test: add hosted MVP smoke workflow"
```

### Task 16 — Quality gate final y handoff

Desde raíz:

```bash
npm ci
npm run lint --prefix frontend
npx supabase start
npx supabase db reset
npx supabase db lint
npx supabase test db
cd backend
uv sync --frozen
PATOPAY_TEST_DATABASE_URL='postgresql+psycopg://patopay_api:...@127.0.0.1:54322/postgres' uv run pytest -q
uv run ruff check .
uv run ruff format --check .
uv run mypy src
git diff --check
cd ..
git status --short --branch
git log --oneline --decorate -20
```

Criterios de cierre:

- suite unitaria/API/integración completa en verde;
- db reset dos veces, lint y pgTAP en verde;
- OpenAPI coincide con matrix;
- smoke hosted real en verde;
- runtime no usa postgres/service-role;
- token inválido y acceso cruzado probados;
- no hay secretos (`git grep` por `supabase.co`, `postgresql://`, JWT y claves debe devolver sólo placeholders/documentación segura);
- `frontend/node_modules` no está rastreado;
- worktree limpio salvo `.hermes/` si el plan se mantiene fuera de Git;
- README/runbook incluye limitación explícita: aprobaciones no son pagos on-chain.

No crear un commit “final” que mezcle arreglos. Si este gate revela algo, volver a RED/GREEN en un commit enfocado.

## Tests / validation

### Matriz mínima

| Área | Caso | Evidencia esperada |
|---|---|---|
| Money | resto 100/3 | 34/33/33 determinista |
| Settlement | múltiples pagadores | `sum(net)=0`, transfers reconcilian |
| Auth | missing/expired/wrong issuer/audience | 401 uniforme |
| Auth | spoof creator | body rechazado, owner=`sub` |
| RLS | usuario B lee evento A | denegado/404 |
| Trigger | alta Auth | exactamente un profile |
| DB role | runtime intenta DDL | permission denied |
| Events | create/list/get/patch | persistencia y version conflict |
| Participants | duplicate/nonmember/referenced delete | 409/403/409 |
| Expenses | selective split | shares persistidos suman amount |
| Finalize | atomicidad | una revision completa o cero writes |
| Finalize | carrera doble | una sola revision activa |
| Decisions | actor/transition | sólo debtor, append-only |
| Dispute deny | estado | request vuelve pending |
| Dispute uphold | history | revision previa immutable/superseded, N+1 activa |
| Idempotency | same key/same payload | misma respuesta |
| Idempotency | same key/different payload | 409 |
| Hosted | magic link + flujo completo | lectura final confirma data remota |

### Disciplina TDD por cada task de código

1. escribir el test focalizado;
2. ejecutar sólo ese test y registrar RED por comportamiento faltante;
3. implementar lo mínimo;
4. ejecutar el test y confirmar GREEN;
5. refactorizar en verde;
6. ejecutar suite relevante, DB tests cuando aplique, Ruff, formatter y mypy;
7. revisar `git diff --check` y staged diff;
8. commit pequeño con los paths de esa slice.

Nunca sustituir integración PostgreSQL por mocks para repositorios, transacciones, locking, RLS o constraints. Los fakes son válidos para Auth y unit tests de aplicación; el adaptador real debe tener tests locales contra PostgreSQL/Supabase.

## Risks, tradeoffs, and open questions

### Riesgos y mitigaciones

1. **Proyecto Supabase hospedado con drift:** hacer `db pull` baseline y `db push --dry-run`; desde entonces prohibir cambios manuales de schema.
2. **RLS falsa:** conectar como `postgres` o service-role omite RLS. Usar `patopay_api` separado y `SET LOCAL` del subject validado.
3. **Supavisor/custom role:** verificar el formato de username y prepared statements en el proyecto real. Para VPS persistente preferir direct IPv6; fallback session pooler 5432.
4. **Auth legacy HS256:** no copiar JWT secret al backend. Migrar a signing keys asimétricas o validar temporalmente contra Auth server.
5. **Trigger de profiles:** un error puede bloquear signup. Cubrirlo con pgTAP y magic-link smoke antes del rollout.
6. **Concurrencia:** finalización/resolución requieren row lock, unique constraints y update optimista, no sólo checks Python.
7. **Dinero/frontend:** los mocks actuales usan números decimales. Backend sólo acepta `amount_minor`; el frontend deberá adaptar display/input en su propia fase.
8. **Semántica de approved:** puede confundirse con pago. Mantener copy/README explícitos y no exponer `paid`.
9. **Greedy settlement:** reduce ciclos y acota transfers, pero no garantiza mínimo global. Es suficiente para MVP.
10. **PII/email:** guardar email facilita invitaciones, pero debe limitarse a participantes/owner y no aparecer en logs.
11. **Borrado de usuario:** `CASCADE` destruiría historia financiera. Usar restrict y diseñar anonimización después.
12. **Idempotency storage:** las respuestas guardadas pueden contener PII; aplicar retención futura y no guardar headers/tokens.
13. **Testing hosted:** magic links tienen rate limits y expiran; el smoke normal debe ser local y el hosted sólo por release.
14. **Tamaño de la fase:** son varias vertical slices. No hacer un mega-commit ni desplegar schema, API y settlement sin gates intermedios.

### Decisiones cerradas

- Proyecto Supabase hosted existente.
- Supabase Auth email magic link/JWT.
- Backend transaccional directo a Postgres, no CRUD encadenado vía PostgREST.
- Schema privado + runtime role least-privilege + RLS.
- Core y Settlement Engine juntos por ahora.
- USDC base units enteros, escala 7.
- División igual selectiva; splits custom fuera de alcance.
- Aprobación de cálculo, sin pago real.
- Corrección sólo mediante disputa resuelta y revisión nueva.

### Preguntas abiertas que deben resolverse antes del rollout remoto, no antes de empezar TDD local

1. ¿El proyecto Supabase existente es exclusivamente staging/dev y puede recibir migrations del MVP sin afectar otros consumidores?
2. ¿El VPS tiene conectividad IPv6 para usar direct connection o necesita Session Pooler?
3. ¿El proyecto ya usa signing keys ES256/RS256 o sigue en HS256 legacy?
4. ¿Cuál es el deep link final de Expo para el callback de magic link?
5. ¿Quién será el único responsable de ejecutar `db push` y rotar el password de `patopay_api`?
6. ¿Se permitirá auto-signup en staging? Recomendado: sí para test; producción debe decidir invitación cerrada antes del lanzamiento.

## Referencias oficiales usadas

- Supabase CLI/migrations: https://supabase.com/docs/guides/local-development/cli-workflows
- Conexiones direct/session/transaction: https://supabase.com/docs/guides/database/connecting-to-postgres
- Magic link: https://supabase.com/docs/guides/auth/auth-email-passwordless
- Redirect allowlist/deep links: https://supabase.com/docs/guides/auth/redirect-urls
- JWT/JWKS: https://supabase.com/docs/guides/auth/jwts
- Signing keys: https://supabase.com/docs/guides/auth/signing-keys
- Server-side token validation: https://supabase.com/docs/reference/python/auth-getuser
- RLS/grants/service role: https://supabase.com/docs/guides/database/postgres/row-level-security
