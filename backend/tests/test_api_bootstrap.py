from httpx import ASGITransport, AsyncClient

from patopay.main import create_app


async def test_api_exposes_event_contract_and_frontend_cors() -> None:
    app = create_app()

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        preflight = await client.options(
            "/api/v1/events",
            headers={
                "Origin": "http://localhost:8081",
                "Access-Control-Request-Method": "POST",
            },
        )
        openapi = await client.get("/openapi.json")

    assert preflight.status_code == 200
    assert preflight.headers["access-control-allow-origin"] == "http://localhost:8081"
    assert sorted(openapi.json()["paths"]) == [
        "/api/v1/events",
        "/api/v1/me",
        "/api/v1/me/payment-policy",
        "/api/v1/me/service-subscriptions",
        "/api/v1/me/service-subscriptions/{service_id}",
        "/api/v1/me/wallets",
        "/api/v1/me/wallets/{wallet_id}",
        "/api/v1/me/wallets/{wallet_id}/balance",
        "/api/v1/profiles",
        "/health",
        "/ready",
    ]
