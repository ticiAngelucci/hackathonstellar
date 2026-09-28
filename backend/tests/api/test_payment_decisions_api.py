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
REQUEST_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"


class FakeVerifier:
    async def verify(self, token: str) -> AuthenticatedActor:
        return AuthenticatedActor(UUID(ACTOR_ID), "authenticated")


def make_app(*, response_status: int = 200) -> tuple[FastAPI, list[httpx.Request]]:
    requests: list[httpx.Request] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if response_status != 200:
            return httpx.Response(response_status, json={"message": "decision failed"})
        body = json.loads(request.content)
        action = body["p_action"]
        return httpx.Response(
            200,
            json={
                "id": REQUEST_ID,
                "status": "approved" if action == "approve" else "rejected",
                "version": 2,
                "next_action": "prepare_sign_and_execute" if action == "approve" else None,
            },
        )

    client = SupabaseClient(
        Settings(env="test", supabase_publishable_key="publishable-test-key"),
        transport=httpx.MockTransport(handler),
    )
    return create_app(supabase_gateway=client, auth_verifier=FakeVerifier()), requests


async def test_approve_sends_versioned_rpc_without_client_actor() -> None:
    app, requests = make_app()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            f"/api/v1/payment-requests/{REQUEST_ID}/approve",
            headers={"Authorization": "Bearer valid-token", "Idempotency-Key": "decision-1"},
            json={"expected_version": 1},
        )

    assert response.status_code == 200
    assert response.json() == {
        "id": REQUEST_ID,
        "status": "approved",
        "version": 2,
        "next_action": "prepare_sign_and_execute",
    }
    assert len(requests) == 1
    assert requests[0].url.path.endswith("/rpc/decide_payment_request")
    assert json.loads(requests[0].content) == {
        "p_request_id": REQUEST_ID,
        "p_action": "approve",
        "p_expected_version": 1,
        "p_idempotency_key": "decision-1",
    }
    assert requests[0].headers["authorization"] == "Bearer valid-token"


async def test_reject_returns_rejected_without_payment_success() -> None:
    app, requests = make_app()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            f"/api/v1/payment-requests/{REQUEST_ID}/reject",
            headers={"Authorization": "Bearer valid-token", "Idempotency-Key": "decision-2"},
            json={"expected_version": 1},
        )

    assert response.status_code == 200
    assert response.json() == {
        "id": REQUEST_ID,
        "status": "rejected",
        "version": 2,
        "next_action": None,
    }
    assert json.loads(requests[0].content)["p_action"] == "reject"


async def test_decision_requires_idempotency_key() -> None:
    app, requests = make_app()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            f"/api/v1/payment-requests/{REQUEST_ID}/approve",
            headers={"Authorization": "Bearer valid-token"},
            json={"expected_version": 1},
        )

    assert response.status_code == 422
    assert requests == []


async def test_stale_expected_version_maps_to_conflict() -> None:
    app, requests = make_app(response_status=409)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            f"/api/v1/payment-requests/{REQUEST_ID}/approve",
            headers={"Authorization": "Bearer valid-token", "Idempotency-Key": "stale"},
            json={"expected_version": 1},
        )

    assert response.status_code == 409
    assert len(requests) == 1


async def test_wrong_payer_maps_to_forbidden() -> None:
    app, requests = make_app(response_status=403)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            f"/api/v1/payment-requests/{REQUEST_ID}/reject",
            headers={"Authorization": "Bearer valid-token", "Idempotency-Key": "wrong-payer"},
            json={"expected_version": 1},
        )

    assert response.status_code == 403
    assert len(requests) == 1
