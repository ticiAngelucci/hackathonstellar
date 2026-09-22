from uuid import UUID

import pytest

from patopay.domain import AmountMinor, PaymentPolicy, RecipientMode

ASSET_ID = UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
OTHER_ASSET_ID = UUID("cccccccc-cccc-4ccc-8ccc-cccccccccccc")
RECIPIENT_ID = UUID("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")


def make_policy(
    *,
    auto_pay_limit_minor: int = 100,
    approval_limit_minor: int = 500,
    daily_limit_minor: int = 1_000,
    recipient_mode: RecipientMode = RecipientMode.ANY,
    allowed_recipients: frozenset[UUID] = frozenset(),
    allowed_assets: frozenset[UUID] = frozenset({ASSET_ID}),
) -> PaymentPolicy:
    return PaymentPolicy(
        auto_pay_limit_minor=auto_pay_limit_minor,
        approval_limit_minor=approval_limit_minor,
        daily_limit_minor=daily_limit_minor,
        recipient_mode=recipient_mode,
        allowed_recipients=allowed_recipients,
        allowed_assets=allowed_assets,
    )


def test_policy_rejects_unordered_auto_and_approval_thresholds() -> None:
    with pytest.raises(ValueError, match=r"auto.*approval"):
        make_policy(auto_pay_limit_minor=501, approval_limit_minor=500)


@pytest.mark.parametrize(
    "overrides",
    [
        {"auto_pay_limit_minor": -1},
        {"approval_limit_minor": 9_000_000_000_000_001},
        {"daily_limit_minor": 0},
        {"daily_limit_minor": 9_000_000_000_000_001},
    ],
)
def test_policy_rejects_limits_outside_supported_range(overrides: dict[str, int]) -> None:
    with pytest.raises(ValueError, match="supported range"):
        make_policy(**overrides)


def test_policy_requires_at_least_one_allowed_asset() -> None:
    with pytest.raises(ValueError, match="allowed asset"):
        make_policy(allowed_assets=frozenset())


def test_allowlist_blocks_unlisted_recipient() -> None:
    policy = make_policy(
        recipient_mode=RecipientMode.ALLOWLIST,
        allowed_recipients=frozenset(),
    )

    decision = policy.evaluate(
        amount=AmountMinor(50),
        recipient_id=RECIPIENT_ID,
        asset_id=ASSET_ID,
        confirmed_daily_minor=0,
    )

    assert decision.outcome == "blocked"
    assert decision.reason_code == "recipient_not_allowed"


def test_policy_blocks_asset_outside_allowlist() -> None:
    decision = make_policy().evaluate(
        amount=AmountMinor(50),
        recipient_id=RECIPIENT_ID,
        asset_id=OTHER_ASSET_ID,
        confirmed_daily_minor=0,
    )

    assert decision.outcome == "blocked"
    assert decision.reason_code == "asset_not_allowed"


def test_policy_blocks_when_confirmed_daily_total_would_exceed_limit() -> None:
    decision = make_policy(daily_limit_minor=1_000).evaluate(
        amount=AmountMinor(50),
        recipient_id=RECIPIENT_ID,
        asset_id=ASSET_ID,
        confirmed_daily_minor=951,
    )

    assert decision.outcome == "blocked"
    assert decision.reason_code == "daily_limit_exceeded"


def test_amount_at_auto_limit_is_only_eligible_for_auto_approval() -> None:
    decision = make_policy(auto_pay_limit_minor=100).evaluate(
        amount=AmountMinor(100),
        recipient_id=RECIPIENT_ID,
        asset_id=ASSET_ID,
        confirmed_daily_minor=0,
    )

    assert decision.outcome == "eligible_for_auto_approval"
    assert decision.reason_code == "within_auto_pay_limit"
    assert decision.outcome != "paid"


def test_amount_between_auto_and_approval_limit_requires_approval() -> None:
    decision = make_policy(
        auto_pay_limit_minor=100,
        approval_limit_minor=500,
    ).evaluate(
        amount=AmountMinor(101),
        recipient_id=RECIPIENT_ID,
        asset_id=ASSET_ID,
        confirmed_daily_minor=0,
    )

    assert decision.outcome == "approval_required"
    assert decision.reason_code == "manual_approval_required"


def test_amount_above_approval_limit_is_blocked() -> None:
    decision = make_policy(approval_limit_minor=500).evaluate(
        amount=AmountMinor(501),
        recipient_id=RECIPIENT_ID,
        asset_id=ASSET_ID,
        confirmed_daily_minor=0,
    )

    assert decision.outcome == "blocked"
    assert decision.reason_code == "approval_limit_exceeded"
