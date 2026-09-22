from typing import Protocol
from uuid import UUID


class AuthVerifier(Protocol):
    async def verify(self, token: str) -> UUID: ...
