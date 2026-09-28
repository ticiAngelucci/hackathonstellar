from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx


@dataclass(frozen=True, slots=True)
class VerificationResult:
    is_valid: bool
    payer: str | None = None
    invalid_reason: str | None = None


@dataclass(frozen=True, slots=True)
class SettlementResult:
    success: bool
    transaction: str | None = None
    network: str | None = None
    payer: str | None = None
    error_reason: str | None = None


class AmbiguousSettlementError(RuntimeError):
    """The facilitator may have submitted a payment before the timeout."""


class X402FacilitatorClient:
    def __init__(
        self,
        base_url: str,
        *,
        timeout_seconds: float = 20.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            timeout=timeout_seconds,
            transport=transport,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def supported(self) -> bool:
        payload = await self._request("/supported", {})
        kinds = payload.get("kinds")
        if not isinstance(kinds, list):
            raise ValueError("facilitator supported response has no kinds")
        return any(
            isinstance(kind, dict)
            and kind.get("x402Version") == 2
            and kind.get("scheme") == "exact"
            and kind.get("network") == "stellar:testnet"
            for kind in kinds
        )

    async def verify(
        self,
        *,
        payment_payload: dict[str, Any],
        requirements: dict[str, Any],
    ) -> VerificationResult:
        payload = await self._request(
            "/verify",
            {"paymentPayload": payment_payload, "paymentRequirements": requirements},
        )
        is_valid = payload.get("isValid")
        if not isinstance(is_valid, bool):
            raise ValueError("facilitator verify response is malformed")
        payer = payload.get("payer")
        invalid_reason = payload.get("invalidReason")
        if payer is not None and not isinstance(payer, str):
            raise ValueError("facilitator payer is malformed")
        if invalid_reason is not None and not isinstance(invalid_reason, str):
            raise ValueError("facilitator invalidReason is malformed")
        return VerificationResult(is_valid, payer, invalid_reason)

    async def settle(
        self,
        *,
        payment_payload: dict[str, Any],
        requirements: dict[str, Any],
    ) -> SettlementResult:
        try:
            payload = await self._request(
                "/settle",
                {"paymentPayload": payment_payload, "paymentRequirements": requirements},
            )
        except httpx.TimeoutException as error:
            raise AmbiguousSettlementError("facilitator settlement timed out") from error
        success = payload.get("success")
        if not isinstance(success, bool):
            raise ValueError("facilitator settlement response is malformed")
        transaction = payload.get("transaction")
        network = payload.get("network")
        payer = payload.get("payer")
        error_reason = payload.get("errorReason")
        if success and (
            not isinstance(transaction, str)
            or len(transaction) != 64
            or any(c not in "0123456789abcdefABCDEF" for c in transaction)
        ):
            raise ValueError("facilitator settlement transaction is malformed")
        if network is not None and not isinstance(network, str):
            raise ValueError("facilitator settlement network is malformed")
        if payer is not None and not isinstance(payer, str):
            raise ValueError("facilitator settlement payer is malformed")
        if error_reason is not None and not isinstance(error_reason, str):
            raise ValueError("facilitator settlement errorReason is malformed")
        return SettlementResult(success, transaction, network, payer, error_reason)

    async def _request(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        response = await self._client.post(path, json=payload)
        response.raise_for_status()
        decoded = response.json()
        if not isinstance(decoded, dict):
            raise ValueError("facilitator response must be a JSON object")
        return decoded
