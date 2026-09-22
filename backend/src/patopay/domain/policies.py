from dataclasses import dataclass
from enum import StrEnum
from uuid import UUID

from patopay.domain.money import MAX_AMOUNT_MINOR, AmountMinor


class RecipientMode(StrEnum):
    ANY = "any"
    ALLOWLIST = "allowlist"


class PolicyOutcome(StrEnum):
    ELIGIBLE_FOR_AUTO_APPROVAL = "eligible_for_auto_approval"
    APPROVAL_REQUIRED = "approval_required"
    BLOCKED = "blocked"


@dataclass(frozen=True, slots=True)
class PolicyDecision:
    outcome: PolicyOutcome
    reason_code: str


@dataclass(frozen=True, slots=True)
class PaymentPolicy:
    auto_pay_limit_minor: int
    approval_limit_minor: int
    daily_limit_minor: int
    recipient_mode: RecipientMode
    allowed_recipients: frozenset[UUID]
    allowed_assets: frozenset[UUID]

    def __post_init__(self) -> None:
        if not (
            0 <= self.auto_pay_limit_minor <= MAX_AMOUNT_MINOR
            and 0 <= self.approval_limit_minor <= MAX_AMOUNT_MINOR
            and 1 <= self.daily_limit_minor <= MAX_AMOUNT_MINOR
        ):
            raise ValueError("policy limits are outside the supported range")
        if self.auto_pay_limit_minor > self.approval_limit_minor:
            raise ValueError("auto pay limit cannot exceed approval limit")
        if not self.allowed_assets:
            raise ValueError("policy requires at least one allowed asset")

    def evaluate(
        self,
        *,
        amount: AmountMinor,
        recipient_id: UUID,
        asset_id: UUID,
        confirmed_daily_minor: int,
    ) -> PolicyDecision:
        if (
            self.recipient_mode is RecipientMode.ALLOWLIST
            and recipient_id not in self.allowed_recipients
        ):
            return PolicyDecision(PolicyOutcome.BLOCKED, "recipient_not_allowed")
        if asset_id not in self.allowed_assets:
            return PolicyDecision(PolicyOutcome.BLOCKED, "asset_not_allowed")
        if confirmed_daily_minor + amount.value > self.daily_limit_minor:
            return PolicyDecision(PolicyOutcome.BLOCKED, "daily_limit_exceeded")
        if amount.value <= self.auto_pay_limit_minor:
            return PolicyDecision(
                PolicyOutcome.ELIGIBLE_FOR_AUTO_APPROVAL,
                "within_auto_pay_limit",
            )
        if amount.value <= self.approval_limit_minor:
            return PolicyDecision(
                PolicyOutcome.APPROVAL_REQUIRED,
                "manual_approval_required",
            )
        return PolicyDecision(PolicyOutcome.BLOCKED, "approval_limit_exceeded")
