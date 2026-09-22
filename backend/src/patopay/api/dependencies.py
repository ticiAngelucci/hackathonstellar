from typing import Annotated, cast

from fastapi import Header, HTTPException, Request, status

from patopay.application.ports import EventService
from patopay.application.ports.auth import AuthenticatedActor, AuthVerifier
from patopay.infrastructure.auth.supabase_jwt import AuthenticationError


async def get_current_actor(
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
) -> AuthenticatedActor:
    if authorization is None or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    verifier = getattr(request.app.state, "auth_verifier", None)
    if verifier is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is not configured",
        )

    try:
        return await cast(AuthVerifier, verifier).verify(token)
    except AuthenticationError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication",
        ) from error


def get_access_token(authorization: Annotated[str | None, Header()] = None) -> str:
    if authorization is None or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    return token


def get_event_service(request: Request) -> EventService:
    service = getattr(request.app.state, "event_service", None)
    if service is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Events service is not configured",
        )
    return cast(EventService, service)
