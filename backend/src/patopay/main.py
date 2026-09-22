from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Protocol, cast

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from patopay.api.router import events_router, router
from patopay.api.routes.policies import router as policies_router
from patopay.api.routes.profiles import router as profiles_router
from patopay.api.routes.service_subscriptions import router as subscriptions_router
from patopay.api.routes.wallets import router as wallets_router
from patopay.application.ports import EventService
from patopay.application.ports.auth import AuthVerifier
from patopay.application.ports.supabase import SupabaseGateway
from patopay.application.use_cases.events import SupabaseEventService
from patopay.config import Settings
from patopay.infrastructure.auth.supabase_jwt import SupabaseJwtVerifier
from patopay.infrastructure.payments.mock import MockPaymentExecutor
from patopay.infrastructure.supabase.client import SupabaseClient
from patopay.infrastructure.supabase.gateway import SupabaseTableGateway


class DisposableSupabase(SupabaseGateway, Protocol):
    async def dispose(self) -> None: ...


class DisposableAuthVerifier(AuthVerifier, Protocol):
    async def dispose(self) -> None: ...


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    try:
        yield
    finally:
        supabase = getattr(application.state, "supabase", None)
        if supabase is not None and hasattr(supabase, "dispose"):
            await cast(DisposableSupabase, supabase).dispose()
        verifier = getattr(application.state, "auth_verifier", None)
        if verifier is not None and hasattr(verifier, "dispose"):
            await cast(DisposableAuthVerifier, verifier).dispose()


def create_app(
    settings: Settings | None = None,
    event_service: EventService | None = None,
    supabase_gateway: SupabaseGateway | None = None,
    auth_verifier: object | None = None,
    payment_executor: object | None = None,
) -> FastAPI:
    resolved_settings = settings or Settings()
    if resolved_settings.payment_executor == "stellar" and payment_executor is None:
        raise RuntimeError("Stellar payment executor is not configured")
    resolved_supabase = (
        supabase_gateway
        if supabase_gateway is not None
        else SupabaseClient(resolved_settings)
        if resolved_settings.supabase_publishable_key
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
    resolved_auth_verifier = auth_verifier
    if resolved_auth_verifier is None and resolved_settings.supabase_publishable_key:
        resolved_auth_verifier = SupabaseJwtVerifier(resolved_settings)
    application.state.supabase = resolved_supabase
    application.state.supabase_gateway = resolved_supabase
    application.state.auth_verifier = resolved_auth_verifier
    application.state.payment_executor = resolved_payment_executor
    resolved_event_service = event_service
    if resolved_event_service is None and isinstance(resolved_supabase, SupabaseClient):
        resolved_event_service = SupabaseEventService(SupabaseTableGateway(resolved_supabase))
    application.state.event_service = resolved_event_service
    application.add_middleware(
        CORSMiddleware,
        allow_origins=resolved_settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(router)
    application.include_router(events_router, prefix=resolved_settings.api_prefix)
    application.include_router(profiles_router, prefix=resolved_settings.api_prefix)
    application.include_router(wallets_router, prefix=resolved_settings.api_prefix)
    application.include_router(policies_router, prefix=resolved_settings.api_prefix)
    application.include_router(subscriptions_router, prefix=resolved_settings.api_prefix)
    return application


app = create_app()
