from dataclasses import dataclass
from enum import StrEnum
from uuid import UUID


class PaymentAttemptStatus(StrEnum):
    PREPARED = "prepared"
    SUBMITTING = "submitting"
    SUBMITTED = "submitted"
    CONFIRMED = "confirmed"
    FAILED = "failed"
    UNKNOWN = "unknown"
    SIMULATED = "simulated"


_ALLOWED_TRANSITIONS: dict[PaymentAttemptStatus, frozenset[PaymentAttemptStatus]] = {
    PaymentAttemptStatus.PREPARED: frozenset(
        {PaymentAttemptStatus.SUBMITTING, PaymentAttemptStatus.SIMULATED}
    ),
    PaymentAttemptStatus.SUBMITTING: frozenset(
        {
            PaymentAttemptStatus.SUBMITTED,
            PaymentAttemptStatus.FAILED,
            PaymentAttemptStatus.UNKNOWN,
        }
    ),
    PaymentAttemptStatus.SUBMITTED: frozenset(
        {PaymentAttemptStatus.CONFIRMED, PaymentAttemptStatus.FAILED, PaymentAttemptStatus.UNKNOWN}
    ),
    PaymentAttemptStatus.UNKNOWN: frozenset(
        {
            PaymentAttemptStatus.SUBMITTED,
            PaymentAttemptStatus.CONFIRMED,
            PaymentAttemptStatus.FAILED,
        }
    ),
    PaymentAttemptStatus.CONFIRMED: frozenset(),
    PaymentAttemptStatus.FAILED: frozenset(),
    PaymentAttemptStatus.SIMULATED: frozenset(),
}


@dataclass(slots=True)
class PaymentAttempt:
    id: UUID
    payment_request_id: UUID
    attempt_number: int
    mode: str
    status: PaymentAttemptStatus = PaymentAttemptStatus.PREPARED
    tx_hash: str | None = None

    def __post_init__(self) -> None:
        if self.attempt_number < 1:
            raise ValueError("attempt number must be positive")
        if self.mode not in {"mock", "stellar"}:
            raise ValueError("payment attempt mode is invalid")

    def transition_to(self, target: PaymentAttemptStatus) -> None:
        if target not in _ALLOWED_TRANSITIONS[self.status]:
            raise ValueError(f"attempt cannot transition from {self.status} to {target}")
        if target is PaymentAttemptStatus.SIMULATED and self.mode != "mock":
            raise ValueError("only mock attempts can be simulated")
        self.status = target
