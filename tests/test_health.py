from httpx import ASGITransport, AsyncClient

from patopay.main import create_app


async def test_health_reports_service_is_ready() -> None:
    app = create_app()

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "patopay-api",
        "version": "0.1.0",
    }
