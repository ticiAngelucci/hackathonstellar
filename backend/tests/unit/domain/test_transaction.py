from uuid import uuid4

import pytest


def test_payment_attempt_allows_prepare_submit_and_confirm() -> None:
    from patopay.domain.transactions import PaymentAttempt, PaymentAttemptStatus

    attempt = PaymentAttempt(
        id=uuid4(),
        payment_request_id=uuid4(),
        attempt_number=1,
        mode="stellar",
    )

    attempt.transition_to(PaymentAttemptStatus.SUBMITTING)
    attempt.transition_to(PaymentAttemptStatus.SUBMITTED)
    attempt.transition_to(PaymentAttemptStatus.CONFIRMED)

    assert attempt.status is PaymentAttemptStatus.CONFIRMED


def test_payment_attempt_rejects_transition_after_terminal_state() -> None:
    from patopay.domain.transactions import PaymentAttempt, PaymentAttemptStatus

    attempt = PaymentAttempt(
        id=uuid4(),
        payment_request_id=uuid4(),
        attempt_number=1,
        mode="stellar",
    )
    attempt.transition_to(PaymentAttemptStatus.SUBMITTING)
    attempt.transition_to(PaymentAttemptStatus.FAILED)

    with pytest.raises(ValueError, match="cannot transition"):
        attempt.transition_to(PaymentAttemptStatus.SUBMITTED)
