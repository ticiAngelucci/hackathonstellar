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
ASSET_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"


class FakeVerifier:
    async def verify(self, token: str) -> AuthenticatedActor:
        return AuthenticatedActor(UUID(ACTOR_ID), "authenticated")


def make_app() -> tuple[FastAPI, list[httpx.Request]]:
    requests: list[httpx.Request] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.url.path.endswith("/rpc/replace_payment_policy"):
            return httpx.Response(
                200,
                json={
                    "id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                    "version": 1,
                    "auto_pay_limit_minor": 300,
                    "approval_limit_minor": 500,
                    "daily_limit_minor": 1000,
                    "recipient_mode": "any",
                    "allowed_recipient_ids": [],
                    "allowed_asset_ids": [ASSET_ID],
                },
            )
        return httpx.Response(200, json=[])

    client = SupabaseClient(
        Settings(env="test", supabase_publishable_key="publishable-test-key"),
        transport=httpx.MockTransport(handler),
    )
    return create_app(supabase_gateway=client, auth_verifier=FakeVerifier()), requests


async def test_policy_update_uses_rpc_and_minor_strings() -> None:
    app, requests = make_app()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.put(
            "/api/v1/me/payment-policy",
            headers={"Authorization": "Bearer valid-token"},
            json={
                "auto_pay_limit_minor": "300",
                "approval_limit_minor": "500",
                "daily_limit_minor": "1000",
                "recipient_mode": "any",
                "allowed_recipient_ids": [],
                "allowed_asset_ids": [ASSET_ID],
                "expected_version": 0,
            },
        )

    assert response.status_code == 200
    assert requests[0].url.path.endswith("/rpc/replace_payment_policy")
    assert json.loads(requests[0].content)["p_auto_pay_limit_minor"] == 300
    assert response.json()["auto_pay_limit_minor"] == "300"


async def test_policy_update_rejects_float_minor_values() -> None:
    app, requests = make_app()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.put(
            "/api/v1/me/payment-policy",
            headers={"Authorization": "Bearer valid-token"},
            json={
                "auto_pay_limit_minor": 5.5,
                "approval_limit_minor": "300",
                "daily_limit_minor": "1000",
                "recipient_mode": "any",
                "allowed_recipient_ids": [],
                "allowed_asset_ids": [ASSET_ID],
                "expected_version": 0,
            },
        )

    assert response.status_code == 422
    assert requests == []
