from uuid import UUID

from patopay.domain.models import EventStatus, Participant
from patopay.infrastructure.memory_event_service import InMemoryEventService

CREATOR_ID = UUID("11111111-1111-4111-8111-111111111111")


async def test_create_event_starts_draft_and_is_listed() -> None:
    service = InMemoryEventService()
    creator = Participant(user_id=CREATOR_ID, display_name="Joaco")

    event = await service.create_event("Asado viernes", creator)

    assert isinstance(event.id, UUID)
    assert event.name == "Asado viernes"
    assert event.creator_id == CREATOR_ID
    assert event.status is EventStatus.DRAFT
    assert event.participants == [creator]
    assert await service.list_events() == [event]
