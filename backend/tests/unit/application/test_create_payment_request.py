import pytest

from patopay.api.schemas.payment_requests import PaymentRequestCreate

ASSET_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
PAYER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"


def test_payment_request_rejects_float_amount() -> None:
    with pytest.raises(ValueError):
        PaymentRequestCreate(
            payer_profile_id=PAYER_ID,
            amount_minor=1.5,
            asset_id=ASSET_ID,
            memo="test",
        )


def test_payment_request_accepts_canonical_minor_string() -> None:
    request = PaymentRequestCreate(
        payer_profile_id=PAYER_ID,
        amount_minor="145000000",
        asset_id=ASSET_ID,
        memo="test",
    )

    assert request.amount_minor == "145000000"
