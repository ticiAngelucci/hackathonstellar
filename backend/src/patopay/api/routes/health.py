from fastapi import APIRouter, HTTPException, Request
from sqlalchemy.exc import SQLAlchemyError
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


@router.get("/ready")
async def ready(request: Request) -> dict[str, str]:
    database = getattr(request.app.state, "database", None)
    if database is None:
        raise HTTPException(status_code=503, detail="Database is not ready")

    try:
        await database.check_connection()
    except (ConnectionError, OSError, SQLAlchemyError) as error:
        raise HTTPException(status_code=503, detail="Database is not ready") from error

    return {"status": "ready"}
