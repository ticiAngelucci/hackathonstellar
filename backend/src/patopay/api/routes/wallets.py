from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from patopay.api.dependencies import get_access_token, get_current_actor
from patopay.api.schemas.wallets import WalletBalanceResponse, WalletCreate, WalletResponse
from patopay.api.supabase_dependencies import get_supabase_table_gateway
from patopay.application.ports.auth import AuthenticatedActor
from patopay.application.use_cases.wallets import WalletService
from patopay.infrastructure.supabase.client import SupabaseApiError
from patopay.infrastructure.supabase.gateway import SupabaseTableGateway

router = APIRouter(tags=["wallets"])
ActorDependency = Annotated[AuthenticatedActor, Depends(get_current_actor)]
TokenDependency = Annotated[str, Depends(get_access_token)]
GatewayDependency = Annotated[SupabaseTableGateway, Depends(get_supabase_table_gateway)]
ExpectedVersionQuery = Annotated[int, Query(ge=1)]


def _service(gateway: SupabaseTableGateway) -> WalletService:
    return WalletService(gateway)


def _map_error(error: Exception) -> HTTPException:
    if isinstance(error, LookupError):
        return HTTPException(status_code=404, detail=str(error))
    if isinstance(error, SupabaseApiError) and error.status_code == 409:
        return HTTPException(status_code=409, detail="Wallet conflicts with an existing binding")
    if isinstance(error, SupabaseApiError):
        return HTTPException(status_code=502, detail="Supabase request failed")
    return HTTPException(status_code=422, detail=str(error))


@router.post("/me/wallets", response_model=WalletResponse, status_code=status.HTTP_201_CREATED)
async def create_wallet(
    payload: WalletCreate,
    actor: ActorDependency,
    token: TokenDependency,
    gateway: GatewayDependency,
) -> dict[str, object]:
    try:
        return await _service(gateway).create(
            actor_id=actor.subject,
            access_token=token,
            payload=payload,
        )
    except (ValueError, SupabaseApiError) as error:
        raise _map_error(error) from error


@router.get("/me/wallets", response_model=list[WalletResponse])
async def list_wallets(
    actor: ActorDependency,
    token: TokenDependency,
    gateway: GatewayDependency,
) -> list[dict[str, object]]:
    return await _service(gateway).list(actor_id=actor.subject, access_token=token)


@router.get("/me/wallets/{wallet_id}", response_model=WalletResponse)
async def get_wallet(
    wallet_id: UUID,
    actor: ActorDependency,
    token: TokenDependency,
    gateway: GatewayDependency,
) -> dict[str, object]:
    try:
        return await _service(gateway).get(
            actor_id=actor.subject,
            wallet_id=wallet_id,
            access_token=token,
        )
    except LookupError as error:
        raise _map_error(error) from error


@router.delete("/me/wallets/{wallet_id}", status_code=status.HTTP_204_NO_CONTENT)
async def disable_wallet(
    wallet_id: UUID,
    expected_version: ExpectedVersionQuery,
    actor: ActorDependency,
    token: TokenDependency,
    gateway: GatewayDependency,
) -> None:
    try:
        await _service(gateway).disable(
            actor_id=actor.subject,
            wallet_id=wallet_id,
            access_token=token,
            expected_version=expected_version,
        )
    except LookupError as error:
        raise _map_error(error) from error


@router.get("/me/wallets/{wallet_id}/balance", response_model=WalletBalanceResponse)
async def get_wallet_balance(
    wallet_id: UUID,
    actor: ActorDependency,
    token: TokenDependency,
    gateway: GatewayDependency,
) -> dict[str, object]:
    try:
        return await _service(gateway).mock_balance(
            actor_id=actor.subject,
            wallet_id=wallet_id,
            access_token=token,
        )
    except LookupError as error:
        raise _map_error(error) from error
