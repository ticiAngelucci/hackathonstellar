from typing import Annotated

from fastapi import APIRouter, Depends, status

from patopay.api.dependencies import get_event_service
from patopay.api.schemas import CreateEventRequest, EventResponse
from patopay.application.ports import EventService

router = APIRouter(prefix="/events", tags=["events"])
EventServiceDependency = Annotated[EventService, Depends(get_event_service)]


@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    payload: CreateEventRequest,
    service: EventServiceDependency,
) -> EventResponse:
    event = await service.create_event(
        name=payload.name,
        creator=payload.creator.to_domain(),
    )
    return EventResponse.from_domain(event)


@router.get("", response_model=list[EventResponse])
async def list_events(service: EventServiceDependency) -> list[EventResponse]:
    events = await service.list_events()
    return [EventResponse.from_domain(event) for event in events]
