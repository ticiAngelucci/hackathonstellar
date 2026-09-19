from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from uuid import UUID


class EventStatus(StrEnum):
    DRAFT = "draft"


@dataclass(frozen=True, slots=True)
class Participant:
    user_id: UUID
    display_name: str


@dataclass(slots=True)
class Event:
    id: UUID
    name: str
    creator_id: UUID
    status: EventStatus
    created_at: datetime
    participants: list[Participant] = field(default_factory=list)
