# Plan de implementación: eventos en memoria para PatoPay

## Goal

Agregar el primer flujo real de dominio —crear y listar eventos— mediante una API FastAPI conectada a un servicio en memoria reemplazable, sin introducir todavía autenticación, PostgreSQL, gastos, balances, agentes ni pagos.

## Current context / assumptions

- Repositorio: `/home/jhaycortez/code/f-projects/f-pato_pay`.
- Backend autocontenido: `/home/jhaycortez/code/f-projects/f-pato_pay/backend`.
- Rama actual: `main`; el worktree está limpio y el árbol fuente ya no tiene duplicados en la raíz.
- Commit base actual: `9ba64e5 Implementacion inicial de la API`.
- Archivos existentes relevantes:
  - `backend/src/patopay/main.py`: crea la aplicación FastAPI, configura CORS y monta el router de health.
  - `backend/src/patopay/config.py`: contiene `Settings`, incluyendo `api_prefix="/api/v1"`.
  - `backend/src/patopay/api/router.py`: actualmente monta sólo `/health`.
  - `backend/tests/test_health.py`: prueba la aplicación mediante `httpx.ASGITransport`.
  - `backend/pyproject.toml`: usa Python `>=3.11,<3.13`, pytest async, Ruff y mypy estricto.
- Todos los comandos de Python deben ejecutarse desde `backend/`.
- No mover archivos fuera de `backend/` ni reintroducir `src/`, `tests/`, `pyproject.toml`, `uv.lock` o `README.md` en la raíz.
- La identidad del creador se recibe en el body sólo para esta fase. No hay autenticación real.
- La persistencia será temporal y en memoria. Reiniciar Uvicorn borra todos los eventos.
- El evento inicial sólo tendrá nombre, creador, estado, fecha y participantes. No incluir `expenses` todavía; ese campo pertenece a una fase posterior.
- Los IDs de usuario y evento serán UUIDs. El backend generará el UUID del evento.
- El servicio de aplicación debe exponerse mediante un `Protocol` para poder sustituir `InMemoryEventService` por PostgreSQL sin modificar las rutas.
- Las rutas HTTP sólo deben convertir schemas, invocar el servicio y serializar respuestas; no deben guardar datos ni contener reglas de dominio.

## Architecture / proposed approach

Implementar una primera vertical slice con cuatro capas: schemas/rutas FastAPI, dependencia que recupera el servicio desde `app.state`, puerto de aplicación `EventService` y adaptador `InMemoryEventService` sobre modelos de dominio independientes de FastAPI. `create_app()` recibirá opcionalmente una implementación del puerto para que los tests inyecten un store aislado y la implementación por defecto use memoria. El contrato público será `POST /api/v1/events` para crear y `GET /api/v1/events` para listar.

La fase demuestra esta conexión sin simular persistencia real: `HTTP → Pydantic → EventService → InMemoryEventService → EventResponse`. El siguiente reemplazo por PostgreSQL podrá conservar las rutas y schemas si mantiene el mismo puerto.

## Step-by-step tasks

### Task 0 — Preflight y protección del árbol del monorepo

Esta tarea es sólo de inspección y no modifica archivos.

Desde la raíz:

```bash
cd /home/jhaycortez/code/f-projects/f-pato_pay
git status --short --branch
git log --oneline --decorate -3
test ! -e src && printf 'root/src absent\n'
test ! -e tests && printf 'root/tests absent\n'
test ! -e pyproject.toml && printf 'root/pyproject.toml absent\n'
test ! -e uv.lock && printf 'root/uv.lock absent\n'
git ls-files backend
```

Resultado esperado:

- La rama sigue siendo `main`.
- El worktree está limpio.
- Los paths fuente de la raíz están ausentes.
- `git ls-files backend` sólo muestra archivos bajo `backend/`.

Si aparece cualquier cambio no creado por esta fase, detenerse y preservarlo. No ejecutar `git reset`, `git clean`, `git stash` ni `git rebase`.

Desde el backend, confirmar la línea base:

```bash
cd /home/jhaycortez/code/f-projects/f-pato_pay/backend
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
uv run mypy src
```

Resultado esperado:

```text
1 passed
All checks passed!
12 files already formatted
Success: no issues found in 10 source files
```

No crear commit para esta tarea.

---

### Task 1 — Modelo de dominio y servicio en memoria

Esta tarea implementa el comportamiento interno antes de exponerlo por HTTP.

#### 1.1. RED: escribir el test del servicio

Crear `backend/tests/test_event_service.py`:

```python
from uuid import UUID, uuid4

from patopay.domain.models import EventStatus, Participant
from patopay.infrastructure.memory_event_service import InMemoryEventService


CREATOR_ID = UUID("11111111-1111-4111-8111-111111111111")


async def test_create_event_starts_draft_and_is_listed() -> None:
    service = InMemoryEventService()
    creator = Participant(user_id=CREATOR_ID, display_name="Joaco")

    event = await service.create_event("Asado viernes", creator)

    assert event.id == UUID(str(event.id))
    assert event.id != uuid4()
    assert event.name == "Asado viernes"
    assert event.creator_id == CREATOR_ID
    assert event.status is EventStatus.DRAFT
    assert event.participants == [creator]
    assert await service.list_events() == [event]
```

El segundo `assert event.id != uuid4()` no prueba una propiedad útil y debe **omitirse**; el test final debe quedar así:

```python
from uuid import UUID

from patopay.domain.models import EventStatus, Participant
from patopay.infrastructure.memory_event_service import InMemoryEventService


CREATOR_ID = UUID("11111111-1111-4111-8111-111111111111")


async def test_create_event_starts_draft_and_is_listed() -> None:
    service = InMemoryEventService()
    creator = Participant(user_id=CREATOR_ID, display_name="Joaco")

    event = await service.create_event("Asado viernes", creator)

    assert isinstance(event.id, UUID)
    assert event.name == "Asado viernes"
    assert event.creator_id == CREATOR_ID
    assert event.status is EventStatus.DRAFT
    assert event.participants == [creator]
    assert await service.list_events() == [event]
```

Ejecutar únicamente el test:

```bash
uv run pytest tests/test_event_service.py::test_create_event_starts_draft_and_is_listed -q
```

RED esperado:

```text
ModuleNotFoundError: No module named 'patopay.domain.models'
```

La colección debe fallar por módulos de producción inexistentes, no por un error de sintaxis o de configuración.

#### 1.2. GREEN: crear los modelos de dominio

Crear `backend/src/patopay/domain/models.py`:

```python
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from uuid import UUID


class EventStatus(StrEnum):
    DRAFT = "draft"


@dataclass(frozen=True, slots=True)
class Participant:
    user_id: UUID
    display_name: str


@dataclass(slots=True)
class Event:
    id: UUID
    name: str
    creator_id: UUID
    status: EventStatus
    created_at: datetime
    participants: list[Participant] = field(default_factory=list)
```

Crear `backend/src/patopay/application/ports.py`:

```python
from typing import Protocol
from uuid import UUID

from patopay.domain.models import Event, Participant


class EventService(Protocol):
    async def list_events(self) -> list[Event]: ...

    async def create_event(self, name: str, creator: Participant) -> Event: ...
```

Crear `backend/src/patopay/infrastructure/memory_event_service.py`:

```python
from datetime import datetime, timezone
from uuid import UUID, uuid4

from patopay.domain.models import Event, EventStatus, Participant


class InMemoryEventService:
    def __init__(self) -> None:
        self._events: dict[UUID, Event] = {}

    async def list_events(self) -> list[Event]:
        return list(self._events.values())

    async def create_event(self, name: str, creator: Participant) -> Event:
        event = Event(
            id=uuid4(),
            name=name,
            creator_id=creator.user_id,
            status=EventStatus.DRAFT,
            created_at=datetime.now(timezone.utc),
            participants=[creator],
        )
        self._events[event.id] = event
        return event
```

Ejecutar el test y los chequeos de las capas nuevas:

```bash
uv run pytest tests/test_event_service.py::test_create_event_starts_draft_and_is_listed -q
uv run ruff check src/patopay/domain src/patopay/application src/patopay/infrastructure tests/test_event_service.py
uv run ruff format --check src/patopay/domain src/patopay/application src/patopay/infrastructure tests/test_event_service.py
uv run mypy src
```

Resultado esperado:

```text
1 passed
All checks passed!
... files already formatted
Success: no issues found in ... source files
```

No agregar validaciones de nombre, repositorios abstractos ni estados futuros todavía. Esas decisiones pertenecen a fases posteriores.

#### 1.3. REFACTOR y commit

Revisar que `InMemoryEventService` no importe FastAPI, Pydantic ni HTTPX y que el modelo de dominio no importe nada de `patopay.api`. Luego ejecutar:

```bash
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
uv run mypy src
git diff --check
```

Resultado esperado:

```text
2 passed
All checks passed!
12 files already formatted
Success: no issues found in ... source files
```

El total exacto puede variar si pytest cuenta fixtures o tests adicionales, pero ambos tests —health y event service— deben pasar.

Revisar el diff y hacer commit sólo de esta tarea:

```bash
git add backend/src/patopay/domain/models.py \
  backend/src/patopay/application/ports.py \
  backend/src/patopay/infrastructure/memory_event_service.py \
  backend/tests/test_event_service.py
git diff --cached --stat
git commit -m "feat: add in-memory event service"
```

Esperado: un commit con los tres módulos de producción y un test, sin tocar frontend ni archivos de raíz.

---

### Task 2 — Exponer crear/listar eventos por HTTP

Esta tarea conecta el servicio de memoria con FastAPI y fija el contrato que consumirá el frontend.

#### 2.1. RED: escribir el test HTTP

Crear `backend/tests/test_events_api.py`:

```python
from httpx import ASGITransport, AsyncClient

from patopay.infrastructure.memory_event_service import InMemoryEventService
from patopay.main import create_app


CREATOR_ID = "11111111-1111-4111-8111-111111111111"


async def test_create_then_list_event() -> None:
    app = create_app(event_service=InMemoryEventService())

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        create_response = await client.post(
            "/api/v1/events",
            json={
                "name": "Asado viernes",
                "creator": {
                    "user_id": CREATOR_ID,
                    "display_name": "Joaco",
                },
            },
        )
        list_response = await client.get("/api/v1/events")

    assert create_response.status_code == 201
    created = create_response.json()
    assert created["name"] == "Asado viernes"
    assert created["creator_id"] == CREATOR_ID
    assert created["status"] == "draft"
    assert created["participants"] == [
        {
            "user_id": CREATOR_ID,
            "display_name": "Joaco",
        }
    ]
    assert "created_at" in created
    assert list_response.status_code == 200
    assert list_response.json() == [created]
```

Ejecutar únicamente el test:

```bash
uv run pytest tests/test_events_api.py::test_create_then_list_event -q
```

RED esperado: el test no debe pasar porque `create_app()` todavía no acepta `event_service` o porque todavía no existe el router/schema de eventos. La primera causa de fallo debe ser un error de comportamiento/estructura ausente, no una importación mal escrita.

#### 2.2. GREEN: crear schemas de entrada y salida

Crear `backend/src/patopay/api/schemas.py`:

```python
from datetime import datetime
from typing import Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from patopay.domain.models import Event, Participant


class ApiModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ParticipantInput(ApiModel):
    user_id: UUID
    display_name: str = Field(min_length=1, max_length=80)

    def to_domain(self) -> Participant:
        return Participant(
            user_id=self.user_id,
            display_name=self.display_name,
        )


class CreateEventRequest(ApiModel):
    name: str = Field(min_length=1, max_length=100)
    creator: ParticipantInput


class ParticipantResponse(ApiModel):
    user_id: UUID
    display_name: str

    @classmethod
    def from_domain(cls, participant: Participant) -> Self:
        return cls(
            user_id=participant.user_id,
            display_name=participant.display_name,
        )


class EventResponse(ApiModel):
    id: UUID
    name: str
    creator_id: UUID
    status: str
    created_at: datetime
    participants: list[ParticipantResponse]

    @classmethod
    def from_domain(cls, event: Event) -> Self:
        return cls(
            id=event.id,
            name=event.name,
            creator_id=event.creator_id,
            status=event.status.value,
            created_at=event.created_at,
            participants=[
                ParticipantResponse.from_domain(participant)
                for participant in event.participants
            ],
        )
```

#### 2.3. GREEN: crear la dependencia del servicio

Crear `backend/src/patopay/api/dependencies.py`:

```python
from typing import cast

from fastapi import Request

from patopay.application.ports import EventService


def get_event_service(request: Request) -> EventService:
    return cast(EventService, request.app.state.event_service)
```

#### 2.4. GREEN: crear las rutas de eventos

Crear `backend/src/patopay/api/routes/events.py`:

```python
from typing import Annotated

from fastapi import APIRouter, Depends, status

from patopay.api.dependencies import get_event_service
from patopay.api.schemas import CreateEventRequest, EventResponse
from patopay.application.ports import EventService

router = APIRouter(prefix="/events", tags=["events"])
EventServiceDependency = Annotated[EventService, Depends(get_event_service)]


@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    payload: CreateEventRequest,
    service: EventServiceDependency,
) -> EventResponse:
    event = await service.create_event(
        name=payload.name,
        creator=payload.creator.to_domain(),
    )
    return EventResponse.from_domain(event)


@router.get("", response_model=list[EventResponse])
async def list_events(service: EventServiceDependency) -> list[EventResponse]:
    events = await service.list_events()
    return [EventResponse.from_domain(event) for event in events]
```

#### 2.5. GREEN: montar el router versionado e inyectar el servicio

Reemplazar `backend/src/patopay/api/router.py` por:

```python
from fastapi import APIRouter

from patopay.api.routes.events import router as events_router
from patopay.api.routes.health import router as health_router

router = APIRouter()
router.include_router(health_router)

__all__ = ["events_router", "router"]
```

Reemplazar `backend/src/patopay/main.py` por:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from patopay.api.router import events_router, router
from patopay.application.ports import EventService
from patopay.config import Settings
from patopay.infrastructure.memory_event_service import InMemoryEventService


def create_app(
    settings: Settings | None = None,
    event_service: EventService | None = None,
) -> FastAPI:
    resolved_settings = settings or Settings()
    application = FastAPI(
        title=resolved_settings.app_name,
        version=resolved_settings.app_version,
    )
    application.state.event_service = (
        event_service if event_service is not None else InMemoryEventService()
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=resolved_settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(router)
    application.include_router(events_router, prefix=resolved_settings.api_prefix)
    return application


app = create_app()
```

Ejecutar el test focalizado:

```bash
uv run pytest tests/test_events_api.py::test_create_then_list_event -q
```

Resultado esperado:

```text
1 passed
```

Después ejecutar el conjunto relevante y la calidad:

```bash
uv run pytest tests/test_health.py tests/test_event_service.py tests/test_events_api.py -q
uv run ruff check .
uv run ruff format --check .
uv run mypy src
```

Resultado esperado:

```text
3 passed
All checks passed!
12 files already formatted
Success: no issues found in ... source files
```

El conteo de archivos formateados puede cambiar; todos los comandos deben salir con código `0`.

#### 2.6. Verificar el contrato OpenAPI y el servidor real

Sin modificar archivos, comprobar las rutas generadas:

```bash
uv run python -c "from patopay.main import app; print(sorted((route.path, sorted(route.methods)) for route in app.routes if route.path.startswith('/api') or route.path == '/health'))"
```

Debe incluir, sin rutas raíz duplicadas:

```text
('/api/v1/events', ['GET', 'POST'])
('/health', ['GET'])
```

Levantar el servidor en un puerto temporal:

```bash
uv run uvicorn patopay.main:app --host 127.0.0.1 --port 8123
```

Desde otra terminal:

```bash
curl --fail --silent --show-error http://127.0.0.1:8123/health
curl --fail --silent --show-error http://127.0.0.1:8123/api/v1/events
```

Respuestas esperadas:

```json
{"status":"ok","service":"patopay-api","version":"0.1.0"}
[]
```

Detener Uvicorn con `Ctrl-C`; no dejar procesos escuchando en el puerto.

#### 2.7. REFACTOR y commit

Revisar que:

- `events.py` no importe `InMemoryEventService` directamente.
- `dependencies.py` sea el único punto que lea `app.state.event_service`.
- `main.py` sea el único lugar que elija la implementación por defecto.
- `schemas.py` no contenga persistencia ni cálculos.
- El response de evento no incluya todavía gastos ni balances.

Ejecutar la quality gate completa:

```bash
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
uv run mypy src
git diff --check
```

Resultado esperado:

```text
3 passed
All checks passed!
12 files already formatted
Success: no issues found in ... source files
```

Commit sólo de los archivos de esta vertical slice:

```bash
git add backend/src/patopay/main.py \
  backend/src/patopay/api/router.py \
  backend/src/patopay/api/dependencies.py \
  backend/src/patopay/api/schemas.py \
  backend/src/patopay/api/routes/events.py \
  backend/tests/test_events_api.py
git diff --cached --stat
git commit -m "feat: expose event creation and listing API"
```

---

### Task 3 — Documentar la conexión y cerrar la fase

Esta tarea no agrega comportamiento; deja explícito cómo se ejecuta y qué sigue siendo mock.

#### 3.1. Actualizar `backend/README.md`

Agregar debajo de la sección `### Primera fase implementada` una sección:

```markdown
### Segunda fase: eventos en memoria

Endpoints disponibles:

```http
POST /api/v1/events
GET /api/v1/events
```

El creador enviado en `POST /api/v1/events` se agrega automáticamente como el
primer participante. Los eventos viven en `InMemoryEventService` y se pierden
al reiniciar el proceso.

La conexión actual es:

```text
HTTP route
  -> EventResponse / CreateEventRequest
  -> EventService protocol
  -> InMemoryEventService
  -> Event / Participant domain models
```

Todavía no se implementaron autenticación, PostgreSQL, gastos, balances,
disputas, x402, Stellar ni agentes autónomos.
```

No duplicar la sección de setup ni mover la documentación de la idea fuera de `backend/README.md`.

#### 3.2. Verificación final de la fase

Desde `backend/`:

```bash
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
uv run mypy src
git diff --check
```

Desde la raíz:

```bash
cd /home/jhaycortez/code/f-projects/f-pato_pay
git status --short --branch
git ls-files | grep -E '^(src|tests|pyproject.toml|uv.lock|README.md)(/|$)' || true
git ls-files backend
```

Resultado esperado:

- pytest, Ruff, formatter, mypy y `git diff --check` salen con código `0`.
- El grep de paths de implementación en la raíz no imprime nada.
- Todos los archivos del backend aparecen bajo `backend/`.
- Sólo quedan cambios rastreados por los commits de esta fase.

Commit de documentación:

```bash
git add backend/README.md
git diff --cached --stat
git commit -m "docs: document event API phase"
```

## Tests / validation

La fase debe terminar con estos comportamientos cubiertos:

| Behavior | Test / command | Expected |
|---|---|---|
| Health existente no se rompe | `uv run pytest tests/test_health.py -q` | `1 passed` |
| Servicio crea un evento | `test_create_event_starts_draft_and_is_listed` | estado `draft`, creador participante, evento listado |
| API crea un evento | `test_create_then_list_event` | `201`, response con UUID, creator y participants |
| API lista eventos | segunda llamada del mismo test | `200`, lista contiene el evento creado |
| Contrato de rutas | inspección de `app.routes` | `/api/v1/events` sólo con `GET` y `POST` |
| Servidor real | `curl /health` y `curl /api/v1/events` | `200`, health estable y lista inicial `[]` |
| Tipos y formato | Ruff + mypy | salida `0` sin diagnósticos |
| No hay duplicación de layout | `git ls-files` desde raíz | implementación sólo bajo `backend/` |

Cada slice de código debe respetar:

1. escribir un test enfocado;
2. ejecutar ese test y confirmar RED por comportamiento faltante;
3. implementar lo mínimo;
4. ejecutar el test focalizado y confirmar GREEN;
5. ejecutar suite, Ruff, formato y mypy;
6. refactorizar sólo estando en GREEN;
7. revisar diff y crear un commit pequeño.

## Risks, tradeoffs, and open questions

### Riesgos y tradeoffs aceptados

- **Memoria de proceso:** dos workers de Uvicorn tendrían stores distintos. Ejecutar con un solo worker hasta introducir PostgreSQL.
- **Sin autenticación:** cualquier cliente puede enviar cualquier UUID como creador. Esto es sólo para integración local y no debe desplegarse así.
- **Contrato inicial estrecho:** no incluye `expenses`, paginación, filtros, actualización, borrado, invitaciones ni permisos.
- **Sin validación de nombres en el servicio:** Pydantic valida el límite HTTP; una futura entrada no HTTP deberá decidir si necesita la misma validación en el dominio.
- **UUIDs generados localmente:** no existe aún una identidad persistida ni un vínculo con Supabase Auth o wallets.
- **Sin repositorio separado:** el puerto `EventService` es suficiente para esta fase; agregar repositorios CRUD antes de PostgreSQL sería estructura especulativa.
- **Commit vacío previo:** `9ba64e5` debe conservarse; no crear otro commit vacío como parte de esta fase salvo que el usuario lo solicite expresamente.

### Preguntas abiertas que no bloquean esta fase

1. ¿La API final usará snake_case o camelCase? El contrato actual conserva snake_case.
2. ¿El usuario de la aplicación se identificará con UUID interno, subject de Supabase o wallet Stellar?
3. ¿Los eventos pertenecerán a un usuario autenticado o se resolverán mediante invitaciones?
4. ¿La persistencia se incorporará antes o después de implementar gastos?
5. ¿El servicio real de settlement vivirá dentro de FastAPI o en el servicio TypeScript de x402?

### Fuera de alcance y siguiente fase

No implementar todavía PostgreSQL, autenticación, participantes como endpoint independiente, gastos ni balances.

El siguiente incremento después de aceptar esta fase será **agregar participantes a un evento** con:

```http
POST /api/v1/events/{event_id}/participants
```

Ese incremento deberá validar eventos existentes, impedir participantes duplicados y rechazar modificaciones después de cerrar el evento, una vez que exista el estado `finalized`.
