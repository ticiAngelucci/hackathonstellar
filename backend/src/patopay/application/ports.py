from typing import Protocol

from patopay.domain.models import Event, Participant


class EventService(Protocol):
    async def list_events(self) -> list[Event]: ...

    async def create_event(self, name: str, creator: Participant) -> Event: ...
