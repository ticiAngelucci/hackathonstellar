from httpx import ASGITransport, AsyncClient

from patopay.infrastructure.memory_event_service import InMemoryEventService
from patopay.main import create_app

CREATOR_ID = "11111111-1111-4111-8111-111111111111"


async def test_create_then_list_event() -> None:
    app = create_app(event_service=InMemoryEventService())

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        create_response = await client.post(
            "/api/v1/events",
            json={
                "name": "Asado viernes",
                "creator": {
                    "user_id": CREATOR_ID,
                    "display_name": "Joaco",
                },
            },
        )
        list_response = await client.get("/api/v1/events")

    assert create_response.status_code == 201
    created = create_response.json()
    assert created["name"] == "Asado viernes"
    assert created["creator_id"] == CREATOR_ID
    assert created["status"] == "draft"
    assert created["participants"] == [
        {
            "user_id": CREATOR_ID,
            "display_name": "Joaco",
        }
    ]
    assert "created_at" in created
    assert list_response.status_code == 200
    assert list_response.json() == [created]
