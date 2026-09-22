from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from uuid import UUID

from patopay.domain.money import AmountMinor


class PaymentRequestStatus(StrEnum):
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    BLOCKED = "blocked"


@dataclass(frozen=True, slots=True)
class PaymentDecision:
    action: str
    actor_id: UUID | None
    decided_at: datetime
    policy_snapshot: tuple[tuple[str, str], ...] = ()


@dataclass(slots=True)
class PaymentRequest:
    id: UUID
    requester_id: UUID
    payer_id: UUID
    source_wallet_id: UUID
    destination_wallet_id: UUID
    asset_id: UUID
    amount: AmountMinor
    created_at: datetime
    status: PaymentRequestStatus = PaymentRequestStatus.PENDING_APPROVAL
    decisions: list[PaymentDecision] = field(default_factory=list)

    def __post_init__(self) -> None:
        if self.requester_id == self.payer_id:
            raise ValueError("requester and payer must differ")
        if self.source_wallet_id == self.destination_wallet_id:
            raise ValueError("source and destination wallets must differ")

    def approve(
        self,
        *,
        actor_id: UUID,
        decided_at: datetime,
        policy_snapshot: tuple[tuple[str, str], ...] = (),
    ) -> None:
        self._decide(
            "approve", PaymentRequestStatus.APPROVED, actor_id, decided_at, policy_snapshot
        )

    def reject(
        self,
        *,
        actor_id: UUID,
        decided_at: datetime,
        policy_snapshot: tuple[tuple[str, str], ...] = (),
    ) -> None:
        self._decide("reject", PaymentRequestStatus.REJECTED, actor_id, decided_at, policy_snapshot)

    def _decide(
        self,
        action: str,
        target: PaymentRequestStatus,
        actor_id: UUID,
        decided_at: datetime,
        policy_snapshot: tuple[tuple[str, str], ...],
    ) -> None:
        if self.status is not PaymentRequestStatus.PENDING_APPROVAL:
            raise ValueError(f"request cannot transition from {self.status}")
        if actor_id != self.payer_id:
            raise ValueError("only the payer can decide a payment request")
        self.decisions.append(PaymentDecision(action, actor_id, decided_at, policy_snapshot))
        self.status = target
