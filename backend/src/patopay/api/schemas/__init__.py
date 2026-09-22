from datetime import datetime
from typing import Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from patopay.domain.models import Event, Participant


class ApiModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ParticipantInput(ApiModel):
    user_id: UUID
    display_name: str = Field(min_length=1, max_length=80)

    def to_domain(self) -> Participant:
        return Participant(
            user_id=self.user_id,
            display_name=self.display_name,
        )


class CreateEventRequest(ApiModel):
    name: str = Field(min_length=1, max_length=100)
    creator: ParticipantInput


class ParticipantResponse(ApiModel):
    user_id: UUID
    display_name: str

    @classmethod
    def from_domain(cls, participant: Participant) -> Self:
        return cls(
            user_id=participant.user_id,
            display_name=participant.display_name,
        )


class EventResponse(ApiModel):
    id: UUID
    name: str
    creator_id: UUID
    status: str
    created_at: datetime
    participants: list[ParticipantResponse]

    @classmethod
    def from_domain(cls, event: Event) -> Self:
        return cls(
            id=event.id,
            name=event.name,
            creator_id=event.creator_id,
            status=event.status.value,
            created_at=event.created_at,
            participants=[
                ParticipantResponse.from_domain(participant) for participant in event.participants
            ],
        )
