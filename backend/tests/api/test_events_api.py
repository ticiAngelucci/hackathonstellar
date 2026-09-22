from uuid import UUID

import httpx
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from patopay.application.ports.auth import AuthenticatedActor
from patopay.config import Settings
from patopay.infrastructure.supabase.client import SupabaseClient
from patopay.main import create_app

ACTOR_ID = "11111111-1111-4111-8111-111111111111"
EVENT_ID = "22222222-2222-4222-8222-222222222222"


class FakeVerifier:
    async def verify(self, token: str) -> AuthenticatedActor:
        assert token == "valid-token"
        return AuthenticatedActor(UUID(ACTOR_ID), "authenticated")


def make_app() -> tuple[FastAPI, list[httpx.Request]]:
    requests: list[httpx.Request] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.url.path.endswith("/rpc/create_event_with_owner"):
            return httpx.Response(
                200,
                json={
                    "id": EVENT_ID,
                    "owner_id": ACTOR_ID,
                    "name": "Asado viernes",
                    "status": "draft",
                    "created_at": "2026-09-22T12:00:00Z",
                    "participants": [
                        {"user_id": ACTOR_ID, "display_name": "Joaco"},
                    ],
                },
            )
        if request.url.path.endswith("/events"):
            return httpx.Response(
                200,
                json=[
                    {
                        "id": EVENT_ID,
                        "owner_id": ACTOR_ID,
                        "name": "Asado viernes",
                        "status": "draft",
                        "created_at": "2026-09-22T12:00:00Z",
                    }
                ],
            )
        if request.url.path.endswith("/event_participants"):
            return httpx.Response(
                200,
                json=[
                    {
                        "event_id": EVENT_ID,
                        "user_id": ACTOR_ID,
                        "role": "owner",
                        "profiles": {"display_name": "Joaco"},
                    }
                ],
            )
        return httpx.Response(404, json={"message": "not found"})

    supabase = SupabaseClient(
        Settings(env="test", supabase_publishable_key="publishable-test-key"),
        transport=httpx.MockTransport(handler),
    )
    return create_app(supabase_gateway=supabase, auth_verifier=FakeVerifier()), requests


async def test_create_event_rejects_creator_from_body() -> None:
    app, requests = make_app()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/events",
            headers={"Authorization": "Bearer valid-token"},
            json={"name": "Asado viernes", "creator": {"user_id": ACTOR_ID}},
        )

    assert response.status_code == 422
    assert requests == []


async def test_create_then_list_event_through_supabase() -> None:
    app, requests = make_app()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        create_response = await client.post(
            "/api/v1/events",
            headers={"Authorization": "Bearer valid-token"},
            json={"name": "Asado viernes"},
        )
        list_response = await client.get(
            "/api/v1/events",
            headers={"Authorization": "Bearer valid-token"},
        )

    assert create_response.status_code == 201
    created = create_response.json()
    assert created["name"] == "Asado viernes"
    assert created["creator_id"] == ACTOR_ID
    assert created["participants"] == [{"user_id": ACTOR_ID, "display_name": "Joaco"}]
    assert list_response.status_code == 200
    assert list_response.json()[0]["id"] == EVENT_ID
    assert any(request.url.path.endswith("/rpc/create_event_with_owner") for request in requests)
