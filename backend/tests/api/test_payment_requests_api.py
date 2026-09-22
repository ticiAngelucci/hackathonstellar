import json
from uuid import UUID

import httpx
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from patopay.application.ports.auth import AuthenticatedActor
from patopay.config import Settings
from patopay.infrastructure.supabase.client import SupabaseClient
from patopay.main import create_app

ACTOR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
PAYER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
ASSET_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
REQUEST_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"


class FakeVerifier:
    async def verify(self, token: str) -> AuthenticatedActor:
        return AuthenticatedActor(UUID(ACTOR_ID), "authenticated")


def make_app() -> tuple[FastAPI, list[httpx.Request]]:
    requests: list[httpx.Request] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            json={
                "id": REQUEST_ID,
                "status": "pending_approval",
                "policy_outcome": "approval_required",
                "reason_code": "manual_approval_required",
                "next_action": "approve_or_reject",
                "amount_minor": "145000000",
                "asset_id": ASSET_ID,
            },
        )

    client = SupabaseClient(
        Settings(env="test", supabase_publishable_key="publishable-test-key"),
        transport=httpx.MockTransport(handler),
    )
    return create_app(supabase_gateway=client, auth_verifier=FakeVerifier()), requests


async def test_payment_request_requires_idempotency_key() -> None:
    app, requests = make_app()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/payment-requests",
            headers={"Authorization": "Bearer valid-token"},
            json={
                "payer_profile_id": PAYER_ID,
                "amount_minor": "145000000",
                "asset_id": ASSET_ID,
                "memo": "Asado",
            },
        )

    assert response.status_code == 422
    assert requests == []


async def test_payment_request_sends_canonical_rpc_payload() -> None:
    app, requests = make_app()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/payment-requests",
            headers={"Authorization": "Bearer valid-token", "Idempotency-Key": "request-1"},
            json={
                "payer_profile_id": PAYER_ID,
                "amount_minor": "145000000",
                "asset_id": ASSET_ID,
                "memo": "Asado",
            },
        )

    assert response.status_code == 201
    assert response.json()["status"] == "pending_approval"
    body = json.loads(requests[0].content)
    assert body["p_amount_minor"] == 145000000
    assert body["p_payer_profile_id"] == PAYER_ID
    assert requests[0].headers["authorization"] == "Bearer valid-token"
