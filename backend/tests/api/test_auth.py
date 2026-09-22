from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, FastAPI
from httpx import ASGITransport, AsyncClient

from patopay.api.dependencies import get_current_actor
from patopay.infrastructure.auth.supabase_jwt import AuthenticatedActor

ACTOR = AuthenticatedActor(
    subject=UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
    role="authenticated",
)


class FakeVerifier:
    async def verify(self, token: str) -> AuthenticatedActor:
        assert token == "valid-token"
        return ACTOR


def make_protected_app() -> FastAPI:
    app = FastAPI()
    app.state.auth_verifier = FakeVerifier()
    router = APIRouter()

    @router.get("/protected")
    async def protected(
        actor: Annotated[AuthenticatedActor, Depends(get_current_actor)],
    ) -> dict[str, str]:
        return {"sub": str(actor.subject)}

    app.include_router(router)
    return app


async def test_protected_route_without_bearer_returns_401() -> None:
    async with AsyncClient(
        transport=ASGITransport(app=make_protected_app()),
        base_url="http://test",
    ) as client:
        response = await client.get("/protected")

    assert response.status_code == 401


async def test_protected_route_with_malformed_bearer_returns_401() -> None:
    async with AsyncClient(
        transport=ASGITransport(app=make_protected_app()),
        base_url="http://test",
    ) as client:
        response = await client.get("/protected", headers={"Authorization": "Basic token"})

    assert response.status_code == 401


async def test_protected_route_uses_verified_actor_subject() -> None:
    async with AsyncClient(
        transport=ASGITransport(app=make_protected_app()),
        base_url="http://test",
    ) as client:
        response = await client.get(
            "/protected",
            headers={"Authorization": "Bearer valid-token"},
        )

    assert response.status_code == 200
    assert response.json() == {"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}
