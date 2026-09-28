import json
from uuid import UUID

import httpx
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from patopay.application.ports.auth import AuthenticatedActor
from patopay.config import Settings
from patopay.infrastructure.stellar.rpc import StellarTransactionResult, StellarTransactionStatus
from patopay.infrastructure.supabase.client import SupabaseClient
from patopay.main import create_app

ACTOR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
ATTEMPT_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
REQUEST_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
TX_HASH = "a" * 64


class FakeVerifier:
    async def verify(self, token: str) -> AuthenticatedActor:
        return AuthenticatedActor(UUID(ACTOR_ID), "authenticated")


class FakeStellarRpc:
    async def get_transaction(self, tx_hash: str) -> StellarTransactionResult:
        return StellarTransactionResult(
            status=StellarTransactionStatus.SUCCESS,
            tx_hash=tx_hash,
            ledger=123,
            receipt={"status": "SUCCESS", "hash": tx_hash, "ledger": 123},
        )


async def test_refresh_confirms_only_a_successful_transaction_with_ledger() -> None:
    requests: list[httpx.Request] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.url.path.endswith("/payment_attempts"):
            return httpx.Response(
                200,
                json=[
                    {
                        "id": ATTEMPT_ID,
                        "payment_request_id": REQUEST_ID,
                        "status": "submitted",
                        "tx_hash": TX_HASH,
                        "preparation_expires_at": "2099-01-01T00:00:00+00:00",
                    }
                ],
            )
        if request.url.path.endswith("/payment_requests"):
            return httpx.Response(200, json=[{"id": REQUEST_ID, "payer_id": ACTOR_ID}])
        if request.url.path.endswith("/rpc/record_payment_confirmation"):
            body = json.loads(request.content)
            assert body == {
                "p_attempt_id": ATTEMPT_ID,
                "p_tx_hash": TX_HASH,
                "p_ledger": 123,
                "p_receipt": {"status": "SUCCESS", "hash": TX_HASH, "ledger": 123},
            }
            return httpx.Response(
                200,
                json={
                    "attempt_id": ATTEMPT_ID,
                    "status": "confirmed",
                    "tx_hash": TX_HASH,
                    "ledger": 123,
                },
            )
        raise AssertionError(f"unexpected request {request.url}")

    app: FastAPI = create_app(
        settings=Settings(env="test"),
        supabase_gateway=SupabaseClient(
            Settings(env="test", supabase_publishable_key="publishable-test-key"),
            transport=httpx.MockTransport(handler),
        ),
        auth_verifier=FakeVerifier(),
        stellar_rpc=FakeStellarRpc(),
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            f"/api/v1/payment-attempts/{ATTEMPT_ID}/refresh",
            headers={"Authorization": "Bearer valid-token", "Idempotency-Key": "refresh-1"},
        )

    assert response.status_code == 200
    assert response.json() == {
        "attempt_id": ATTEMPT_ID,
        "status": "confirmed",
        "tx_hash": TX_HASH,
        "ledger": 123,
        "next_action": "complete",
    }
    assert any(
        request.url.path.endswith("/rpc/record_payment_confirmation") for request in requests
    )
