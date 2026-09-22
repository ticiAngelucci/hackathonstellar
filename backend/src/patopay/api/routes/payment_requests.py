from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status

from patopay.api.dependencies import get_access_token, get_current_actor
from patopay.api.schemas.payment_requests import (
    PaymentRequestCreate,
    PaymentRequestResponse,
    PaymentRequestSummary,
)
from patopay.api.supabase_dependencies import get_supabase_table_gateway
from patopay.application.ports.auth import AuthenticatedActor
from patopay.application.use_cases.payment_requests import PaymentRequestService
from patopay.infrastructure.supabase.client import SupabaseApiError
from patopay.infrastructure.supabase.gateway import SupabaseTableGateway

router = APIRouter(tags=["payment-requests"])
ActorDependency = Annotated[AuthenticatedActor, Depends(get_current_actor)]
TokenDependency = Annotated[str, Depends(get_access_token)]
GatewayDependency = Annotated[SupabaseTableGateway, Depends(get_supabase_table_gateway)]
IdempotencyHeader = Annotated[str | None, Header(alias="Idempotency-Key")]
StatusQuery = Annotated[str | None, Query()]


def _service(gateway: SupabaseTableGateway) -> PaymentRequestService:
    return PaymentRequestService(gateway)


@router.post(
    "/payment-requests",
    response_model=PaymentRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_payment_request(
    payload: PaymentRequestCreate,
    actor: ActorDependency,
    token: TokenDependency,
    idempotency_key: IdempotencyHeader,
    gateway: GatewayDependency,
) -> dict[str, object]:
    if idempotency_key is None:
        raise HTTPException(status_code=422, detail="Idempotency-Key is required")
    try:
        return await _service(gateway).create(
            payload=payload,
            access_token=token,
            idempotency_key=idempotency_key,
        )
    except SupabaseApiError as error:
        code = 409 if error.status_code in {400, 409} else 502
        raise HTTPException(status_code=code, detail="Payment request creation failed") from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get("/payment-requests", response_model=list[PaymentRequestSummary])
async def list_payment_requests(
    actor: ActorDependency,
    token: TokenDependency,
    gateway: GatewayDependency,
    status_filter: StatusQuery = None,
) -> list[dict[str, object]]:
    return await _service(gateway).list(access_token=token, status_filter=status_filter)


@router.get("/payment-requests/{request_id}", response_model=PaymentRequestSummary)
async def get_payment_request(
    request_id: UUID,
    actor: ActorDependency,
    token: TokenDependency,
    gateway: GatewayDependency,
) -> dict[str, object]:
    try:
        return await _service(gateway).get(request_id=request_id, access_token=token)
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
