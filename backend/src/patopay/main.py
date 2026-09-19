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
