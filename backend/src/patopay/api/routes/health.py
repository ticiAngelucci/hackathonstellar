import httpx
from fastapi import APIRouter, HTTPException, Request
from typing_extensions import TypedDict

from patopay.infrastructure.supabase.client import SupabaseApiError

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
    supabase = getattr(request.app.state, "supabase", None)
    if supabase is None:
        raise HTTPException(status_code=503, detail="Supabase is not ready")

    try:
        await supabase.check_connection()
    except (ConnectionError, OSError, ValueError, SupabaseApiError, httpx.HTTPError) as error:
        raise HTTPException(status_code=503, detail="Supabase is not ready") from error

    return {"status": "ready"}
