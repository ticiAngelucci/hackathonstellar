from httpx import ASGITransport, AsyncClient

from patopay.main import create_app


class HealthySupabase:
    async def check_connection(self) -> None:
        return None


class UnavailableSupabase:
    async def check_connection(self) -> None:
        raise ConnectionError("Supabase unavailable")


async def test_ready_reports_supabase_ready() -> None:
    app = create_app(supabase_gateway=HealthySupabase())

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.get("/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready"}


async def test_ready_reports_not_ready_when_supabase_is_unavailable() -> None:
    app = create_app(supabase_gateway=UnavailableSupabase())

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.get("/ready")

    assert response.status_code == 503
    assert response.json() == {"detail": "Supabase is not ready"}
