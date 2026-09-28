from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from patopay.application.ports.stellar import StellarTransactionReader, StellarTransactionStatus
from patopay.infrastructure.stellar.rpc import StellarRpcAmbiguousError
from patopay.infrastructure.supabase.gateway import SupabaseTableGateway


class PaymentReconciliationService:
    def __init__(self, gateway: SupabaseTableGateway, reader: StellarTransactionReader) -> None:
        self._gateway = gateway
        self._reader = reader

    async def reconcile(
        self,
        *,
        attempt_id: UUID,
        actor_id: UUID,
        access_token: str,
    ) -> dict[str, Any]:
        attempts = await self._gateway.select(
            "payment_attempts",
            access_token=access_token,
            filters={
                "select": "id,payment_request_id,status,tx_hash,preparation_expires_at",
                "id": f"eq.{attempt_id}",
                "limit": "1",
            },
        )
        if not attempts:
            raise LookupError("payment attempt not found")
        attempt = attempts[0]
        requests = await self._gateway.select(
            "payment_requests",
            access_token=access_token,
            filters={
                "select": "id,payer_id",
                "id": f"eq.{attempt['payment_request_id']}",
                "limit": "1",
            },
        )
        if not requests or requests[0].get("payer_id") != str(actor_id):
            raise PermissionError("only the payer can reconcile a payment attempt")
        tx_hash = attempt.get("tx_hash")
        if not isinstance(tx_hash, str):
            raise ValueError("payment attempt has no transaction hash")
        try:
            observed = await self._reader.get_transaction(tx_hash)
        except StellarRpcAmbiguousError:
            await self._record_unknown(attempt_id, access_token, "stellar_rpc_timeout")
            return {"attempt_id": str(attempt_id), "status": "unknown", "next_action": "reconcile"}

        if observed.status is StellarTransactionStatus.SUCCESS:
            if observed.ledger is None:
                raise ValueError("successful transaction has no ledger")
            result = await self._gateway.rpc(
                "record_payment_confirmation",
                {
                    "p_attempt_id": str(attempt_id),
                    "p_tx_hash": observed.tx_hash,
                    "p_ledger": observed.ledger,
                    "p_receipt": observed.receipt,
                },
                access_token=access_token,
            )
            if not isinstance(result, dict):
                raise ValueError("confirmation RPC returned an invalid payload")
            return {
                "attempt_id": str(attempt_id),
                "status": "confirmed",
                "tx_hash": observed.tx_hash,
                "ledger": observed.ledger,
                "next_action": "complete",
            }

        if observed.status is StellarTransactionStatus.FAILED:
            result = await self._gateway.rpc(
                "record_payment_failure",
                {"p_attempt_id": str(attempt_id), "p_error_code": "stellar_transaction_failed"},
                access_token=access_token,
            )
            if not isinstance(result, dict):
                raise ValueError("failure RPC returned an invalid payload")
            return {
                "attempt_id": str(attempt_id),
                "status": "failed",
                "next_action": "manual_review",
            }

        if observed.status is StellarTransactionStatus.NOT_FOUND and self._expired(attempt):
            await self._record_unknown(
                attempt_id, access_token, "stellar_transaction_not_found_after_expiry"
            )
            return {
                "attempt_id": str(attempt_id),
                "status": "unknown",
                "next_action": "manual_review",
            }
        return {
            "attempt_id": str(attempt_id),
            "status": attempt.get("status", "unknown"),
            "next_action": "reconcile",
        }

    async def _record_unknown(self, attempt_id: UUID, access_token: str, error_code: str) -> None:
        await self._gateway.rpc(
            "record_payment_unknown",
            {"p_attempt_id": str(attempt_id), "p_error_code": error_code},
            access_token=access_token,
        )

    @staticmethod
    def _expired(attempt: dict[str, Any]) -> bool:
        raw_expiry = attempt.get("preparation_expires_at")
        if not isinstance(raw_expiry, str):
            return True
        expiry = datetime.fromisoformat(raw_expiry.replace("Z", "+00:00"))
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=UTC)
        return expiry <= datetime.now(UTC)
