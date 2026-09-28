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
USDC_CONTRACT_ID = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"


class FakeVerifier:
    async def verify(self, token: str) -> AuthenticatedActor:
        return AuthenticatedActor(UUID(ACTOR_ID), "authenticated")


def make_app() -> tuple[FastAPI, list[httpx.Request]]:
    requests: list[httpx.Request] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            json=[
                {
                    "id": ASSET_ID,
                    "network": "testnet",
                    "contract_address": USDC_CONTRACT_ID,
                    "code": "USDC",
                    "decimals": 7,
                    "enabled": True,
                }
            ],
        )

    client = SupabaseClient(
        Settings(env="test", supabase_publishable_key="publishable-test-key"),
        transport=httpx.MockTransport(handler),
    )
    return create_app(supabase_gateway=client, auth_verifier=FakeVerifier()), requests


async def test_assets_requires_authentication() -> None:
    app, requests = make_app()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/assets")

    assert response.status_code == 401
    assert requests == []


async def test_assets_lists_enabled_testnet_usdc_through_postgrest() -> None:
    app, requests = make_app()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(
            "/api/v1/assets",
            headers={"Authorization": "Bearer valid-token"},
        )

    assert response.status_code == 200
    assert response.json() == [
        {
            "id": ASSET_ID,
            "network": "testnet",
            "contract_address": USDC_CONTRACT_ID,
            "code": "USDC",
            "decimals": 7,
            "enabled": True,
        }
    ]
    assert len(requests) == 1
    request = requests[0]
    assert request.method == "GET"
    assert request.url.path == "/rest/v1/assets"
    assert dict(request.url.params) == {
        "select": "id,network,contract_address,code,decimals,enabled",
        "network": "eq.testnet",
        "code": "eq.USDC",
        "enabled": "eq.true",
    }
    assert request.headers["authorization"] == "Bearer valid-token"
    assert request.headers["accept-profile"] == "patopay"
