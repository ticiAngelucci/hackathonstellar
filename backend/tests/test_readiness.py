from httpx import ASGITransport, AsyncClient

from patopay.main import create_app


class HealthyDatabase:
    async def check_connection(self) -> None:
        return None


class UnavailableDatabase:
    async def check_connection(self) -> None:
        raise ConnectionError("database unavailable")


async def test_ready_reports_database_ready() -> None:
    app = create_app(database=HealthyDatabase())

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.get("/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready"}


async def test_ready_reports_not_ready_when_database_is_unavailable() -> None:
    app = create_app(database=UnavailableDatabase())

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.get("/ready")

    assert response.status_code == 503
    assert response.json() == {"detail": "Database is not ready"}
