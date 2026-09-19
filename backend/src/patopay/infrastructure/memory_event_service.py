from datetime import UTC, datetime
from uuid import UUID, uuid4

from patopay.domain.models import Event, EventStatus, Participant


class InMemoryEventService:
    def __init__(self) -> None:
        self._events: dict[UUID, Event] = {}

    async def list_events(self) -> list[Event]:
        return list(self._events.values())

    async def create_event(self, name: str, creator: Participant) -> Event:
        event = Event(
            id=uuid4(),
            name=name,
            creator_id=creator.user_id,
            status=EventStatus.DRAFT,
            created_at=datetime.now(UTC),
            participants=[creator],
        )
        self._events[event.id] = event
        return event
