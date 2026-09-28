from typing import Annotated

from fastapi import APIRouter, Depends

from patopay.api.dependencies import get_access_token, get_current_actor
from patopay.api.schemas.assets import AssetResponse
from patopay.api.supabase_dependencies import get_supabase_table_gateway
from patopay.application.ports.auth import AuthenticatedActor
from patopay.application.use_cases.assets import AssetRegistry
from patopay.infrastructure.supabase.gateway import SupabaseTableGateway

router = APIRouter(tags=["assets"])
ActorDependency = Annotated[AuthenticatedActor, Depends(get_current_actor)]
TokenDependency = Annotated[str, Depends(get_access_token)]
GatewayDependency = Annotated[SupabaseTableGateway, Depends(get_supabase_table_gateway)]


@router.get("/assets", response_model=list[AssetResponse])
async def list_assets(
    _actor: ActorDependency,
    token: TokenDependency,
    gateway: GatewayDependency,
) -> list[dict[str, object]]:
    return await AssetRegistry(gateway).list_enabled(access_token=token)
