from typing import Annotated

from fastapi import APIRouter, Depends, status

from patopay.api.dependencies import get_access_token, get_event_service
from patopay.api.schemas.events import CreateEventRequest, EventResponse
from patopay.application.ports import EventService

router = APIRouter(prefix="/events", tags=["events"])
EventServiceDependency = Annotated[EventService, Depends(get_event_service)]
TokenDependency = Annotated[str, Depends(get_access_token)]


@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    payload: CreateEventRequest,
    service: EventServiceDependency,
    token: TokenDependency,
) -> EventResponse:
    event = await service.create_event(name=payload.name, access_token=token)
    return EventResponse.from_domain(event)


@router.get("", response_model=list[EventResponse])
async def list_events(
    service: EventServiceDependency,
    token: TokenDependency,
) -> list[EventResponse]:
    events = await service.list_events(access_token=token)
    return [EventResponse.from_domain(event) for event in events]
