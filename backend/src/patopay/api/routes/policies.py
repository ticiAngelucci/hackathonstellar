from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from patopay.api.dependencies import get_access_token, get_current_actor
from patopay.api.schemas.policies import PaymentPolicyResponse, PaymentPolicyUpdate
from patopay.api.supabase_dependencies import get_supabase_table_gateway
from patopay.application.ports.auth import AuthenticatedActor
from patopay.application.use_cases.policies import PolicyService, PolicyValidationError
from patopay.infrastructure.supabase.client import SupabaseApiError
from patopay.infrastructure.supabase.gateway import SupabaseTableGateway

router = APIRouter(tags=["policies"])
ActorDependency = Annotated[AuthenticatedActor, Depends(get_current_actor)]
TokenDependency = Annotated[str, Depends(get_access_token)]
GatewayDependency = Annotated[SupabaseTableGateway, Depends(get_supabase_table_gateway)]


def _service(gateway: SupabaseTableGateway) -> PolicyService:
    return PolicyService(gateway)


def _policy_response(value: dict[str, object]) -> dict[str, object]:
    return {
        "id": value["id"],
        "version": value["version"],
        "auto_pay_limit_minor": str(value["auto_pay_limit_minor"]),
        "approval_limit_minor": str(value["approval_limit_minor"]),
        "daily_limit_minor": str(value["daily_limit_minor"]),
        "recipient_mode": value["recipient_mode"],
        "allowed_recipient_ids": value.get("allowed_recipient_ids", []),
        "allowed_asset_ids": value.get("allowed_asset_ids", []),
    }


@router.get("/me/payment-policy", response_model=PaymentPolicyResponse)
async def get_policy(
    actor: ActorDependency,
    token: TokenDependency,
    gateway: GatewayDependency,
) -> dict[str, object]:
    try:
        value = await _service(gateway).get(
            actor_id=actor.subject,
            access_token=token,
        )
        return _policy_response(value)
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except SupabaseApiError as error:
        raise HTTPException(status_code=502, detail="Supabase request failed") from error


@router.put("/me/payment-policy", response_model=PaymentPolicyResponse)
async def replace_policy(
    payload: PaymentPolicyUpdate,
    actor: ActorDependency,
    token: TokenDependency,
    gateway: GatewayDependency,
) -> dict[str, object]:
    try:
        value = await _service(gateway).replace(
            actor_id=actor.subject,
            access_token=token,
            values=payload.model_dump(),
        )
        return _policy_response(value)
    except PolicyValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except SupabaseApiError as error:
        status_code = 409 if error.status_code in {400, 409} else 502
        raise HTTPException(status_code=status_code, detail="Policy update failed") from error
