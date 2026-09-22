import httpx
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from patopay.application.ports.auth import AuthenticatedActor
from patopay.config import Settings
from patopay.infrastructure.supabase.client import SupabaseClient
from patopay.main import create_app

ACTOR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"


class FakeVerifier:
    async def verify(self, token: str) -> AuthenticatedActor:
        assert token == "valid-token"
        from uuid import UUID

        return AuthenticatedActor(UUID(ACTOR_ID), "authenticated")


def make_app() -> tuple[FastAPI, list[httpx.Request]]:
    requests: list[httpx.Request] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.method == "GET" and request.url.path.endswith("/profiles"):
            return httpx.Response(
                200,
                json=[
                    {
                        "id": ACTOR_ID,
                        "username": "joaco",
                        "display_name": "Joaco",
                        "notifications_enabled": True,
                    }
                ],
            )
        return httpx.Response(
            200,
            json=[
                {
                    "id": ACTOR_ID,
                    "username": "joaco",
                    "display_name": "Nuevo nombre",
                    "notifications_enabled": True,
                }
            ],
        )

    supabase = SupabaseClient(
        Settings(env="test", supabase_publishable_key="publishable-test-key"),
        transport=httpx.MockTransport(handler),
    )
    return create_app(supabase_gateway=supabase, auth_verifier=FakeVerifier()), requests


async def test_me_derives_profile_id_from_jwt() -> None:
    app, requests = make_app()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(
            "/api/v1/me",
            headers={"Authorization": "Bearer valid-token"},
        )

    assert response.status_code == 200
    assert response.json()["id"] == ACTOR_ID
    assert "email" not in response.json()
    assert requests[0].url.params["id"] == f"eq.{ACTOR_ID}"
    assert requests[0].headers["authorization"] == "Bearer valid-token"
    assert requests[0].headers["accept-profile"] == "patopay"


async def test_me_update_cannot_replace_actor_id() -> None:
    app, requests = make_app()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.patch(
            "/api/v1/me",
            headers={"Authorization": "Bearer valid-token"},
            json={"display_name": "Nuevo nombre", "id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"},
        )

    assert response.status_code == 422
    assert len(requests) == 0


async def test_profile_lookup_uses_exact_username_and_minimal_fields() -> None:
    app, requests = make_app()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(
            "/api/v1/profiles",
            params={"username": "joaco"},
            headers={"Authorization": "Bearer valid-token"},
        )

    assert response.status_code == 200
    assert response.json() == {
        "id": ACTOR_ID,
        "username": "joaco",
        "display_name": "Joaco",
    }
    assert requests[0].url.params["username"] == "eq.joaco"
