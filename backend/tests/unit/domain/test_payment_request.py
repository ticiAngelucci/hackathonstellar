from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest

from patopay.domain import AmountMinor, PaymentRequest

REQUESTER_ID = UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
PAYER_ID = UUID("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
WALLET_FROM = UUID("cccccccc-cccc-4ccc-8ccc-cccccccccccc")
WALLET_TO = UUID("dddddddd-dddd-4ddd-8ddd-dddddddddddd")
ASSET_ID = UUID("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee")


def make_request() -> PaymentRequest:
    return PaymentRequest(
        id=uuid4(),
        requester_id=REQUESTER_ID,
        payer_id=PAYER_ID,
        source_wallet_id=WALLET_FROM,
        destination_wallet_id=WALLET_TO,
        asset_id=ASSET_ID,
        amount=AmountMinor(100),
        created_at=datetime.now(UTC),
    )


def test_payment_request_approval_transition_is_valid() -> None:
    request = make_request()

    request.approve(actor_id=PAYER_ID, decided_at=datetime.now(UTC))

    assert request.status.value == "approved"
    assert len(request.decisions) == 1
    assert request.decisions[0].action == "approve"


def test_payment_request_rejects_repeated_terminal_transition() -> None:
    request = make_request()
    request.approve(actor_id=PAYER_ID, decided_at=datetime.now(UTC))

    with pytest.raises(ValueError, match="cannot transition"):
        request.approve(actor_id=PAYER_ID, decided_at=datetime.now(UTC))


def test_payment_decision_snapshot_is_append_only_and_immutable() -> None:
    request = make_request()
    snapshot = (("policy_version", "1"), ("approval_limit_minor", "500"))

    request.approve(
        actor_id=PAYER_ID,
        decided_at=datetime.now(UTC),
        policy_snapshot=snapshot,
    )

    assert request.decisions[0].policy_snapshot == snapshot
    with pytest.raises(AttributeError):
        request.decisions[0].policy_snapshot += (("changed", "yes"),)
