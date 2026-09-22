from typing import Protocol

from patopay.domain.models import Event


class EventService(Protocol):
    async def list_events(self, *, access_token: str) -> list[Event]: ...

    async def create_event(self, *, name: str, access_token: str) -> Event: ...


__all__ = ["EventService"]
