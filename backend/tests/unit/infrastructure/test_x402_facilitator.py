import json

import httpx
import pytest

from patopay.infrastructure.x402.client import (
    AmbiguousSettlementError,
    X402FacilitatorClient,
)

REQUIREMENTS = {
    "x402Version": 2,
    "accepts": [{"scheme": "exact", "network": "stellar:testnet", "amount": "1000000"}],
}
PAYLOAD = {
    "x402Version": 2,
    "accepted": REQUIREMENTS["accepts"][0],
    "payload": {"authorization": "opaque"},
}


def make_client(handler):
    return X402FacilitatorClient(
        "https://facilitator.example.test", transport=httpx.MockTransport(handler)
    )


@pytest.mark.asyncio
async def test_supported_requires_exact_stellar_testnet() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/supported"
        return httpx.Response(
            200,
            json={"kinds": [{"x402Version": 2, "scheme": "exact", "network": "stellar:testnet"}]},
        )

    assert await make_client(handler).supported() is True


@pytest.mark.asyncio
async def test_verify_and_settle_send_v2_payloads_and_parse_results() -> None:
    paths: list[str] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        paths.append(request.url.path)
        assert json.loads(request.content) == {
            "paymentPayload": PAYLOAD,
            "paymentRequirements": REQUIREMENTS,
        }
        if request.url.path == "/verify":
            return httpx.Response(200, json={"isValid": True, "payer": "Cpayer"})
        return httpx.Response(
            200,
            json={
                "success": True,
                "transaction": "a" * 64,
                "network": "stellar:testnet",
                "payer": "Cpayer",
            },
        )

    client = make_client(handler)
    assert (
        await client.verify(payment_payload=PAYLOAD, requirements=REQUIREMENTS)
    ).is_valid is True
    result = await client.settle(payment_payload=PAYLOAD, requirements=REQUIREMENTS)
    assert result.transaction == "a" * 64
    assert paths == ["/verify", "/settle"]


@pytest.mark.asyncio
async def test_settle_timeout_is_ambiguous() -> None:
    async def handler(_: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("provider timed out")

    with pytest.raises(AmbiguousSettlementError):
        await make_client(handler).settle(payment_payload=PAYLOAD, requirements=REQUIREMENTS)


@pytest.mark.asyncio
async def test_malformed_settlement_fails_closed() -> None:
    async def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"success": True, "network": "stellar:testnet"})

    with pytest.raises(ValueError, match="transaction"):
        await make_client(handler).settle(payment_payload=PAYLOAD, requirements=REQUIREMENTS)
