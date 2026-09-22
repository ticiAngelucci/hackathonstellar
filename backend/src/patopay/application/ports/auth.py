from dataclasses import dataclass
from typing import Protocol
from uuid import UUID


@dataclass(frozen=True, slots=True)
class AuthenticatedActor:
    subject: UUID
    role: str
    email: str | None = None


class AuthVerifier(Protocol):
    async def verify(self, token: str) -> AuthenticatedActor: ...
