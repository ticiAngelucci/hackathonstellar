from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Protocol, cast

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from patopay.api.router import events_router, router
from patopay.application.ports import EventService
from patopay.config import Settings
from patopay.infrastructure.memory_event_service import InMemoryEventService
from patopay.infrastructure.postgres.database import Database, DatabaseHealth


class DisposableDatabase(DatabaseHealth, Protocol):
    async def dispose(self) -> None: ...


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    try:
        yield
    finally:
        database = getattr(application.state, "database", None)
        if database is not None and hasattr(database, "dispose"):
            await cast(DisposableDatabase, database).dispose()


def create_app(
    settings: Settings | None = None,
    event_service: EventService | None = None,
    database: DatabaseHealth | None = None,
) -> FastAPI:
    resolved_settings = settings or Settings()
    resolved_database = (
        database
        if database is not None
        else Database(resolved_settings)
        if resolved_settings.database_url
        else None
    )
    application = FastAPI(
        title=resolved_settings.app_name,
        version=resolved_settings.app_version,
        lifespan=lifespan,
    )
    application.state.database = resolved_database
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
