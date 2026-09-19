from typing import cast

from fastapi import Request

from patopay.application.ports import EventService


def get_event_service(request: Request) -> EventService:
    return cast(EventService, request.app.state.event_service)
