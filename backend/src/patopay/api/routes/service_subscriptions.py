from typing import Annotated, Any, cast

from fastapi import APIRouter, Depends, HTTPException

from patopay.api.dependencies import get_access_token, get_current_actor
from patopay.api.schemas.policies import ServiceSubscriptionUpdate
from patopay.api.supabase_dependencies import get_supabase_table_gateway
from patopay.application.ports.auth import AuthenticatedActor
from patopay.infrastructure.supabase.gateway import SupabaseTableGateway

router = APIRouter(tags=["service-subscriptions"])
ActorDependency = Annotated[AuthenticatedActor, Depends(get_current_actor)]
TokenDependency = Annotated[str, Depends(get_access_token)]
GatewayDependency = Annotated[SupabaseTableGateway, Depends(get_supabase_table_gateway)]
ALLOWED_SERVICE_IDS = frozenset({"electricity", "internet", "water"})


@router.get("/me/service-subscriptions")
async def list_subscriptions(
    actor: ActorDependency,
    token: TokenDependency,
    gateway: GatewayDependency,
) -> list[dict[str, object]]:
    return await gateway.select(
        "service_subscriptions",
        access_token=token,
        filters={
            "select": "service_id,enabled,updated_at",
            "user_id": f"eq.{actor.subject}",
        },
    )


@router.put("/me/service-subscriptions/{service_id}")
async def update_subscription(
    service_id: str,
    payload: ServiceSubscriptionUpdate,
    actor: ActorDependency,
    token: TokenDependency,
    gateway: GatewayDependency,
) -> dict[str, object]:
    if service_id not in ALLOWED_SERVICE_IDS:
        raise HTTPException(status_code=422, detail="Service is not allowed")
    rows = await gateway.insert(
        "service_subscriptions",
        {"user_id": str(actor.subject), "service_id": service_id, "enabled": payload.enabled},
        access_token=token,
        params={"on_conflict": "user_id,service_id", "select": "service_id,enabled,updated_at"},
    )
    if not isinstance(rows, list) or not rows:
        raise HTTPException(status_code=502, detail="Supabase did not return subscription")
    return cast(dict[str, Any], rows[0])
