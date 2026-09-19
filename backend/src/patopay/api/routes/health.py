from fastapi import APIRouter
from typing_extensions import TypedDict

router = APIRouter(tags=["health"])


class HealthResponse(TypedDict):
    status: str
    service: str
    version: str


@router.get("/health")
async def health() -> HealthResponse:
    return {
        "status": "ok",
        "service": "patopay-api",
        "version": "0.1.0",
    }
