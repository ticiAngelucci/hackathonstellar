import base64
import json
from uuid import UUID

import httpx
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from patopay.application.ports.auth import AuthenticatedActor
from patopay.application.ports.x402 import SettlementResult, VerificationResult
from patopay.config import Settings
from patopay.infrastructure.supabase.client import SupabaseClient
from patopay.infrastructure.x402.codec import encode_payment_header
from patopay.main import create_app

ACTOR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
REQUEST_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
ATTEMPT_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
ASSET_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff"
DESTINATION_WALLET_ID = "11111111-1111-4111-8111-111111111111"
ASSET = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"
DESTINATION = "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"


class FakeVerifier:
    async def verify(self, token: str) -> AuthenticatedActor:
        return AuthenticatedActor(UUID(ACTOR_ID), "authenticated")


class FakeFacilitator:
    def __init__(self) -> None:
        self.verify_calls = 0
        self.settle_calls = 0

    async def supported(self) -> bool:
        return True

    async def verify(self, *, payment_payload: dict, requirements: dict) -> VerificationResult:
        self.verify_calls += 1
        return VerificationResult(is_valid=True, payer="Cpayer")

    async def settle(self, *, payment_payload: dict, requirements: dict) -> SettlementResult:
        self.settle_calls += 1
        return SettlementResult(
            success=True,
            transaction="a" * 64,
            network="stellar:testnet",
            payer="Cpayer",
        )


def make_app(facilitator: FakeFacilitator | None = None) -> tuple[FastAPI, list[httpx.Request]]:
    requests: list[httpx.Request] = []
    prepared_requirements: dict = {}

    async def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.url.path.endswith("/payment_requests"):
            return httpx.Response(
                200,
                json=[
                    {
                        "id": REQUEST_ID,
                        "payer_id": ACTOR_ID,
                        "status": "approved",
                        "version": 2,
                        "amount_minor": 1000000,
                        "asset_id": ASSET_ID,
                        "destination_wallet_id": DESTINATION_WALLET_ID,
                    }
                ],
            )
        if request.url.path.endswith("/assets"):
            return httpx.Response(
                200,
                json=[{"id": ASSET_ID, "contract_address": ASSET, "enabled": True}],
            )
        if request.url.path.endswith("/wallets"):
            return httpx.Response(
                200,
                json=[{"id": DESTINATION_WALLET_ID, "contract_address": DESTINATION}],
            )
        if request.url.path.endswith("/payment_attempts"):
            return httpx.Response(
                200,
                json=[
                    {
                        "id": ATTEMPT_ID,
                        "payment_request_id": REQUEST_ID,
                        "status": "prepared",
                        "payment_requirements": prepared_requirements,
                        "payment_payload_hash": None,
                    }
                ],
            )
        if request.url.path.endswith("/rpc/prepare_payment_attempt"):
            body = json.loads(request.content)
            prepared_requirements.update(body["p_payment_requirements"])
            return httpx.Response(
                200,
                json={
                    "attempt_id": body["p_attempt_id"],
                    "payment_request_id": body["p_request_id"],
                    "status": "prepared",
                    "payment_requirements": body["p_payment_requirements"],
                    "preparation_expires_at": body["p_preparation_expires_at"],
                },
            )
        if request.url.path.endswith("/rpc/consume_payment_attempt"):
            return httpx.Response(200, json={"attempt_id": ATTEMPT_ID, "status": "submitting"})
        if request.url.path.endswith("/rpc/record_payment_submission"):
            return httpx.Response(200, json={"attempt_id": ATTEMPT_ID, "status": "submitted"})
        raise AssertionError(f"unexpected request {request.url}")

    client = SupabaseClient(
        Settings(env="test", supabase_publishable_key="publishable-test-key"),
        transport=httpx.MockTransport(handler),
    )
    return (
        create_app(
            supabase_gateway=client,
            auth_verifier=FakeVerifier(),
            x402_facilitator=facilitator,
        ),
        requests,
    )


async def test_settle_without_signature_returns_402_with_canonical_requirements() -> None:
    app, requests = make_app()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            f"/api/v1/payment-requests/{REQUEST_ID}/settle",
            headers={"Authorization": "Bearer valid-token", "Idempotency-Key": "settle-1"},
            json={"expected_version": 2, "attempt_id": ATTEMPT_ID},
        )

    assert response.status_code == 402
    assert response.headers["payment-required"]
    body = response.json()
    assert body["attempt_id"] == ATTEMPT_ID
    assert body["status"] == "prepared"
    assert body["next_action"] == "sign_x402"
    required = json.loads(base64.b64decode(response.headers["payment-required"]))
    accepted = required["accepts"][0]
    assert required["x402Version"] == 2
    assert accepted["scheme"] == "exact"
    assert accepted["network"] == "stellar:testnet"
    assert accepted["amount"] == "1000000"
    assert accepted["asset"] == ASSET
    assert accepted["payTo"] == DESTINATION
    assert not any(
        "stellar" in str(request.content).lower()
        for request in requests
        if "/rpc/" not in request.url.path
    )


async def test_valid_signature_verifies_and_submits_without_marking_paid() -> None:
    facilitator = FakeFacilitator()
    app, _ = make_app(facilitator)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        prepared = await client.post(
            f"/api/v1/payment-requests/{REQUEST_ID}/settle",
            headers={"Authorization": "Bearer valid-token", "Idempotency-Key": "settle-prepare"},
            json={"expected_version": 2, "attempt_id": ATTEMPT_ID},
        )
        required = json.loads(base64.b64decode(prepared.headers["payment-required"]))
        payment_payload = {
            "x402Version": 2,
            "accepted": required["accepts"][0],
            "payload": {"authorization": "opaque"},
        }
        response = await client.post(
            f"/api/v1/payment-requests/{REQUEST_ID}/settle",
            headers={
                "Authorization": "Bearer valid-token",
                "Idempotency-Key": "settle-submit",
                "PAYMENT-SIGNATURE": encode_payment_header(payment_payload),
            },
            json={"expected_version": 3, "attempt_id": ATTEMPT_ID},
        )

    assert response.status_code == 202
    assert response.json() == {
        "attempt_id": ATTEMPT_ID,
        "status": "submitted",
        "tx_hash": "a" * 64,
        "next_action": "reconcile",
    }
    assert facilitator.verify_calls == 1
    assert facilitator.settle_calls == 1
