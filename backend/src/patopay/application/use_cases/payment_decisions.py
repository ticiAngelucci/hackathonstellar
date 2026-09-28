from typing import Any, Literal
from uuid import UUID

from patopay.infrastructure.supabase.gateway import SupabaseTableGateway

DecisionAction = Literal["approve", "reject"]


class PaymentDecisionService:
    def __init__(self, gateway: SupabaseTableGateway) -> None:
        self._gateway = gateway

    async def decide(
        self,
        *,
        request_id: UUID,
        action: DecisionAction,
        expected_version: int,
        idempotency_key: str,
        access_token: str,
    ) -> dict[str, Any]:
        if not 1 <= len(idempotency_key) <= 128:
            raise ValueError("Idempotency-Key is required")
        result = await self._gateway.rpc(
            "decide_payment_request",
            {
                "p_request_id": str(request_id),
                "p_action": action,
                "p_expected_version": expected_version,
                "p_idempotency_key": idempotency_key,
            },
            access_token=access_token,
        )
        if not isinstance(result, dict):
            raise ValueError("Supabase payment decision RPC returned an invalid payload")
        return result
