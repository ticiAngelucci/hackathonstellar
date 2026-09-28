from dataclasses import dataclass
from typing import Any, Protocol


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


class X402Facilitator(Protocol):
    async def supported(self) -> bool: ...

    async def verify(
        self,
        *,
        payment_payload: dict[str, Any],
        requirements: dict[str, Any],
    ) -> VerificationResult: ...

    async def settle(
        self,
        *,
        payment_payload: dict[str, Any],
        requirements: dict[str, Any],
    ) -> SettlementResult: ...
