import base64
import json

import pytest
from pydantic import ValidationError

from patopay.api.schemas.x402 import X402Accepted, X402PaymentRequired, X402Resource
from patopay.infrastructure.x402.codec import decode_payment_header, encode_payment_header


def test_payment_header_round_trip_preserves_decimal_string() -> None:
    payload = {"x402Version": 2, "accepted": {"amount": "0001000", "scheme": "exact"}}

    encoded = encode_payment_header(payload)

    assert decode_payment_header(encoded) == payload


def test_decode_rejects_invalid_or_oversized_payload() -> None:
    with pytest.raises(ValueError, match="Base64"):
        decode_payment_header("not-base64!!!")
    with pytest.raises(ValueError, match="100 KiB"):
        decode_payment_header(base64.b64encode(b"{" + b"a" * (100 * 1024) + b"}").decode())


def test_decode_rejects_json_arrays() -> None:
    encoded = base64.b64encode(json.dumps(["not", "object"]).encode()).decode()

    with pytest.raises(ValueError, match="JSON object"):
        decode_payment_header(encoded)


def test_payment_required_uses_v2_exact_stellar_testnet() -> None:
    required = X402PaymentRequired(
        resource=X402Resource(url="https://api.example.test/data", description="data"),
        accepts=[
            X402Accepted(
                amount="1000000",
                asset="CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
                pay_to="CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
                max_timeout_seconds=60,
            )
        ],
    )

    dumped = required.model_dump(by_alias=True)

    assert dumped["x402Version"] == 2
    assert dumped["accepts"][0]["scheme"] == "exact"
    assert dumped["accepts"][0]["network"] == "stellar:testnet"
    assert dumped["accepts"][0]["amount"] == "1000000"


def test_payment_required_rejects_wrong_network() -> None:
    with pytest.raises(ValidationError):
        X402Accepted(
            amount="1000000",
            asset="CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
            pay_to="CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
            network="stellar:mainnet",
            max_timeout_seconds=60,
        )
