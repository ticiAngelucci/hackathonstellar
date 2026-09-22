from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from patopay.api.dependencies import get_access_token, get_current_actor
from patopay.api.schemas.profiles import ProfileResponse, ProfileUpdate, PublicProfileResponse
from patopay.api.supabase_dependencies import get_supabase_table_gateway
from patopay.application.ports.auth import AuthenticatedActor
from patopay.application.use_cases.profiles import ProfileService
from patopay.infrastructure.supabase.client import SupabaseApiError
from patopay.infrastructure.supabase.gateway import SupabaseTableGateway

router = APIRouter(tags=["profiles"])
ActorDependency = Annotated[AuthenticatedActor, Depends(get_current_actor)]
TokenDependency = Annotated[str, Depends(get_access_token)]
GatewayDependency = Annotated[SupabaseTableGateway, Depends(get_supabase_table_gateway)]
UsernameQuery = Annotated[
    str,
    Query(min_length=3, max_length=40, pattern=r"^[a-z0-9_]+$"),
]


def _service(gateway: SupabaseTableGateway) -> ProfileService:
    return ProfileService(gateway)


def _not_found(error: LookupError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))


def _supabase_error(error: SupabaseApiError) -> HTTPException:
    if error.status_code == 409:
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Profile conflict")
    return HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Supabase request failed")


@router.get("/me", response_model=ProfileResponse)
async def get_me(
    actor: ActorDependency,
    token: TokenDependency,
    gateway: GatewayDependency,
) -> dict[str, object]:
    try:
        return await _service(gateway).get_me(actor_id=actor.subject, access_token=token)
    except LookupError as error:
        raise _not_found(error) from error
    except SupabaseApiError as error:
        raise _supabase_error(error) from error


@router.put("/me", response_model=ProfileResponse)
async def put_me(
    payload: ProfileUpdate,
    actor: ActorDependency,
    token: TokenDependency,
    gateway: GatewayDependency,
) -> dict[str, object]:
    try:
        return await _service(gateway).upsert_me(
            actor_id=actor.subject,
            access_token=token,
            values=payload.model_dump(exclude_none=True),
        )
    except SupabaseApiError as error:
        raise _supabase_error(error) from error


@router.patch("/me", response_model=ProfileResponse)
async def patch_me(
    payload: ProfileUpdate,
    actor: ActorDependency,
    token: TokenDependency,
    gateway: GatewayDependency,
) -> dict[str, object]:
    try:
        return await _service(gateway).patch_me(
            actor_id=actor.subject,
            access_token=token,
            values=payload.model_dump(exclude_none=True),
        )
    except LookupError as error:
        raise _not_found(error) from error
    except SupabaseApiError as error:
        raise _supabase_error(error) from error


@router.get("/profiles", response_model=PublicProfileResponse)
async def lookup_profile(
    username: UsernameQuery,
    token: TokenDependency,
    gateway: GatewayDependency,
) -> dict[str, object]:
    try:
        return await _service(gateway).lookup_by_username(username=username, access_token=token)
    except LookupError as error:
        raise _not_found(error) from error
    except SupabaseApiError as error:
        raise _supabase_error(error) from error
