from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from patopay.infrastructure.supabase.gateway import SupabaseTableGateway


class SettlementPreparationService:
    def __init__(self, gateway: SupabaseTableGateway, *, max_timeout_seconds: int = 60) -> None:
        self._gateway = gateway
        self._max_timeout_seconds = max_timeout_seconds

    async def prepare(
        self,
        *,
        request_id: UUID,
        expected_version: int,
        attempt_id: UUID | None,
        idempotency_key: str,
        access_token: str,
        resource_url: str,
    ) -> dict[str, Any]:
        request_rows = await self._gateway.select(
            "payment_requests",
            access_token=access_token,
            filters={
                "select": "id,payer_id,status,version,amount_minor,asset_id,destination_wallet_id",
                "id": f"eq.{request_id}",
                "limit": "1",
            },
        )
        if not request_rows:
            raise LookupError("payment request not found")
        payment_request = request_rows[0]
        asset_rows = await self._gateway.select(
            "assets",
            access_token=access_token,
            filters={
                "select": "id,contract_address,enabled,network,code,decimals",
                "id": f"eq.{payment_request['asset_id']}",
                "enabled": "eq.true",
                "limit": "1",
            },
        )
        wallet_rows = await self._gateway.select(
            "wallets",
            access_token=access_token,
            filters={
                "select": "id,contract_address,status,provider,network",
                "id": f"eq.{payment_request['destination_wallet_id']}",
                "limit": "1",
            },
        )
        if not asset_rows or not wallet_rows:
            raise LookupError("payment settlement configuration not found")
        asset = asset_rows[0]
        destination = wallet_rows[0]
        expires_at = datetime.now(UTC) + timedelta(seconds=self._max_timeout_seconds)
        requirements = {
            "x402Version": 2,
            "resource": {
                "url": resource_url,
                "description": "PatoPay payment settlement",
                "mimeType": "application/json",
            },
            "accepts": [
                {
                    "scheme": "exact",
                    "network": "stellar:testnet",
                    "amount": str(payment_request["amount_minor"]),
                    "asset": asset["contract_address"],
                    "payTo": destination["contract_address"],
                    "maxTimeoutSeconds": self._max_timeout_seconds,
                    "extra": {},
                }
            ],
        }
        result = await self._gateway.rpc(
            "prepare_payment_attempt",
            {
                "p_request_id": str(request_id),
                "p_expected_version": expected_version,
                "p_attempt_id": str(attempt_id or uuid4()),
                "p_payment_requirements": requirements,
                "p_preparation_expires_at": expires_at.isoformat(),
                "p_idempotency_key": idempotency_key,
            },
            access_token=access_token,
        )
        if not isinstance(result, dict):
            raise ValueError("Supabase settlement preparation RPC returned an invalid payload")
        return result
