from fastapi import APIRouter

from patopay.api.routes.events import router as events_router
from patopay.api.routes.health import router as health_router

router = APIRouter()
router.include_router(health_router)

__all__ = ["events_router", "router"]
