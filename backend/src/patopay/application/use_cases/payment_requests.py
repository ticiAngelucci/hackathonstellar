from typing import Any
from uuid import UUID

from patopay.api.schemas.payment_requests import PaymentRequestCreate
from patopay.infrastructure.supabase.gateway import SupabaseTableGateway


class PaymentRequestService:
    def __init__(self, gateway: SupabaseTableGateway) -> None:
        self._gateway = gateway

    async def create(
        self,
        *,
        payload: PaymentRequestCreate,
        access_token: str,
        idempotency_key: str,
    ) -> dict[str, Any]:
        if not 1 <= len(idempotency_key) <= 128:
            raise ValueError("Idempotency-Key is required")
        result = await self._gateway.rpc(
            "create_payment_request",
            {
                "p_payer_profile_id": str(payload.payer_profile_id),
                "p_amount_minor": int(payload.amount_minor),
                "p_asset_id": str(payload.asset_id),
                "p_memo": payload.memo,
                "p_idempotency_key": idempotency_key,
            },
            access_token=access_token,
        )
        if not isinstance(result, dict):
            raise ValueError("Supabase payment request RPC returned an invalid payload")
        return result

    async def list(
        self,
        *,
        access_token: str,
        status_filter: str | None = None,
    ) -> list[dict[str, Any]]:
        filters = {
            "select": "id,requester_id,payer_id,asset_id,amount_minor,memo,status,created_at",
            "order": "created_at.desc,id.desc",
        }
        if status_filter is not None:
            filters["status"] = f"eq.{status_filter}"
        return await self._gateway.select(
            "payment_requests",
            access_token=access_token,
            filters=filters,
        )

    async def get(self, *, request_id: UUID, access_token: str) -> dict[str, Any]:
        rows = await self._gateway.select(
            "payment_requests",
            access_token=access_token,
            filters={
                "select": "id,requester_id,payer_id,asset_id,amount_minor,memo,status,created_at",
                "id": f"eq.{request_id}",
                "limit": "1",
            },
        )
        if not rows:
            raise LookupError("payment request not found")
        return rows[0]
