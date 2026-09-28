import json

import httpx
import pytest

from patopay.infrastructure.stellar.rpc import (
    StellarRpcAmbiguousError,
    StellarRpcClient,
    StellarTransactionStatus,
)

TX_HASH = "a" * 64


def make_client(handler):
    return StellarRpcClient(
        "https://soroban-testnet.stellar.org", transport=httpx.MockTransport(handler)
    )


@pytest.mark.asyncio
async def test_get_transaction_success_returns_ledger_and_sanitized_receipt() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        assert body["method"] == "getTransaction"
        assert body["params"] == {"hash": TX_HASH}
        return httpx.Response(
            200,
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "result": {
                    "status": "SUCCESS",
                    "hash": TX_HASH,
                    "ledger": 123,
                    "envelopeXdr": "must-not-leak",
                    "resultXdr": "must-not-leak",
                    "events": [{"type": "contract"}],
                },
            },
        )

    result = await make_client(handler).get_transaction(TX_HASH)

    assert result.status is StellarTransactionStatus.SUCCESS
    assert result.ledger == 123
    assert result.tx_hash == TX_HASH
    assert result.receipt == {
        "status": "SUCCESS",
        "hash": TX_HASH,
        "ledger": 123,
        "events": [{"type": "contract"}],
    }


@pytest.mark.asyncio
async def test_timeout_is_ambiguous() -> None:
    async def handler(_: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("rpc timed out")

    with pytest.raises(StellarRpcAmbiguousError):
        await make_client(handler).get_transaction(TX_HASH)


@pytest.mark.asyncio
async def test_invalid_hash_is_rejected_before_rpc() -> None:
    called = False

    async def handler(_: httpx.Request) -> httpx.Response:
        nonlocal called
        called = True
        return httpx.Response(200, json={})

    with pytest.raises(ValueError, match="64 hexadecimal"):
        await make_client(handler).get_transaction("not-a-hash")
    assert called is False


@pytest.mark.asyncio
async def test_failed_and_not_found_statuses_are_explicit() -> None:
    statuses = iter(["FAILED", "NOT_FOUND"])

    async def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"result": {"status": next(statuses)}})

    client = make_client(handler)
    assert (await client.get_transaction(TX_HASH)).status is StellarTransactionStatus.FAILED
    assert (await client.get_transaction(TX_HASH)).status is StellarTransactionStatus.NOT_FOUND
