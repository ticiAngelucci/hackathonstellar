from uuid import UUID

import httpx
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from patopay.application.ports.auth import AuthenticatedActor
from patopay.config import Settings
from patopay.infrastructure.supabase.client import SupabaseClient
from patopay.main import create_app

ACTOR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
WALLET_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
CONTRACT_ID = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"


class FakeVerifier:
    async def verify(self, token: str) -> AuthenticatedActor:
        return AuthenticatedActor(UUID(ACTOR_ID), "authenticated")


def make_app() -> tuple[FastAPI, list[httpx.Request]]:
    requests: list[httpx.Request] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.method == "POST":
            return httpx.Response(
                201,
                json=[
                    {
                        "id": WALLET_ID,
                        "provider": "stellar",
                        "network": "testnet",
                        "contract_address": CONTRACT_ID,
                        "wallet_wasm_hash": None,
                        "creation_tx_hash": None,
                        "status": "unverified",
                        "is_default": False,
                        "version": 1,
                    }
                ],
            )
        if request.url.path.endswith("mock_wallet_balances"):
            return httpx.Response(
                200,
                json=[
                    {
                        "wallet_id": WALLET_ID,
                        "balance_minor": 100000000,
                        "observed_at": "2026-09-22T12:00:00Z",
                    }
                ],
            )
        return httpx.Response(
            200,
            json=[
                {
                    "id": WALLET_ID,
                    "provider": "stellar",
                    "network": "testnet",
                    "contract_address": CONTRACT_ID,
                    "wallet_wasm_hash": None,
                    "creation_tx_hash": None,
                    "status": "unverified",
                    "is_default": False,
                    "version": 1,
                }
            ],
        )

    client = SupabaseClient(
        Settings(env="test", supabase_publishable_key="publishable-test-key"),
        transport=httpx.MockTransport(handler),
    )
    return create_app(supabase_gateway=client, auth_verifier=FakeVerifier()), requests


async def test_wallet_registration_accepts_public_metadata_only() -> None:
    app, requests = make_app()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/me/wallets",
            headers={"Authorization": "Bearer valid-token"},
            json={"provider": "stellar", "network": "testnet", "contract_address": CONTRACT_ID},
        )

    assert response.status_code == 201
    assert response.json()["status"] == "unverified"
    assert "private_key" not in response.json()
    assert requests[0].headers["authorization"] == "Bearer valid-token"


async def test_wallet_registration_rejects_private_material() -> None:
    app, requests = make_app()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/me/wallets",
            headers={"Authorization": "Bearer valid-token"},
            json={
                "provider": "stellar",
                "network": "testnet",
                "contract_address": CONTRACT_ID,
                "private_key": "never",
            },
        )

    assert response.status_code == 422
    assert requests == []


async def test_mock_balance_returns_minor_units_and_observation() -> None:
    app, _ = make_app()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(
            f"/api/v1/me/wallets/{WALLET_ID}/balance",
            headers={"Authorization": "Bearer valid-token"},
        )

    assert response.status_code == 200
    assert response.json()["amount_minor"] == "100000000"
    assert response.json()["mode"] == "mock"
