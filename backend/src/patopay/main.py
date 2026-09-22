from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Protocol, cast
from uuid import UUID

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from patopay.api.router import events_router, router
from patopay.application.ports import EventService
from patopay.config import Settings
from patopay.infrastructure.memory_event_service import InMemoryEventService
from patopay.infrastructure.payments.mock import MockPaymentExecutor
from patopay.infrastructure.postgres.database import Database, DatabaseHealth
from patopay.infrastructure.postgres.unit_of_work import PostgresUnitOfWork


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
    auth_verifier: object | None = None,
    unit_of_work_factory: object | None = None,
    payment_executor: object | None = None,
) -> FastAPI:
    resolved_settings = settings or Settings()
    if resolved_settings.payment_executor == "stellar" and payment_executor is None:
        raise RuntimeError("Stellar payment executor is not configured")
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
    resolved_payment_executor = payment_executor
    if resolved_payment_executor is None and resolved_settings.payment_executor == "mock":
        resolved_payment_executor = MockPaymentExecutor()
    resolved_uow_factory = unit_of_work_factory
    if resolved_uow_factory is None and isinstance(resolved_database, Database):

        def database_uow_factory(subject_id: UUID | str) -> PostgresUnitOfWork:
            return PostgresUnitOfWork(
                session_factory=resolved_database.session_factory,
                subject_id=subject_id,
            )

        resolved_uow_factory = database_uow_factory
    application.state.database = resolved_database
    application.state.auth_verifier = auth_verifier
    application.state.unit_of_work_factory = resolved_uow_factory
    application.state.payment_executor = resolved_payment_executor
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
