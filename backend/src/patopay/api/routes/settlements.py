from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import JSONResponse

from patopay.api.dependencies import get_access_token, get_current_actor
from patopay.api.schemas.settlements import SettlementPreparedResponse, SettlementPrepareRequest
from patopay.api.schemas.x402 import X402PaymentRequired
from patopay.api.supabase_dependencies import get_supabase_table_gateway
from patopay.application.ports.auth import AuthenticatedActor
from patopay.application.ports.x402 import X402Facilitator
from patopay.application.use_cases.reconciliation import PaymentReconciliationService
from patopay.application.use_cases.settlements import SettlementPreparationService
from patopay.infrastructure.supabase.client import SupabaseApiError
from patopay.infrastructure.supabase.gateway import SupabaseTableGateway
from patopay.infrastructure.x402.client import AmbiguousSettlementError
from patopay.infrastructure.x402.codec import (
    decode_payment_header,
    encode_payment_header,
    payment_payload_hash,
)

router = APIRouter(tags=["settlements"])
ActorDependency = Annotated[AuthenticatedActor, Depends(get_current_actor)]
TokenDependency = Annotated[str, Depends(get_access_token)]
GatewayDependency = Annotated[SupabaseTableGateway, Depends(get_supabase_table_gateway)]
IdempotencyHeader = Annotated[str | None, Header(alias="Idempotency-Key")]
PaymentSignatureHeader = Annotated[str | None, Header(alias="PAYMENT-SIGNATURE")]


def _preparation_status(error: SupabaseApiError) -> int:
    if error.status_code in {400, 409}:
        return 409
    if error.status_code == 403:
        return 403
    return 502


def _requirements_header(requirements: dict[str, Any]) -> str:
    required = X402PaymentRequired.model_validate(
        {**requirements, "error": "PAYMENT-SIGNATURE header is required"}
    )
    return encode_payment_header(required.model_dump(by_alias=True))


def _error_402(message: str, requirements: dict[str, Any]) -> JSONResponse:
    return JSONResponse(
        status_code=402,
        content={"status": "failed", "error": message, "next_action": "prepare_sign_x402"},
        headers={"PAYMENT-REQUIRED": _requirements_header(requirements)},
    )


async def _settle_signed_payment(
    *,
    request_id: UUID,
    payload: SettlementPrepareRequest,
    signature: str,
    token: str,
    idempotency_key: str,
    gateway: SupabaseTableGateway,
    facilitator: X402Facilitator | None,
) -> JSONResponse:
    if payload.attempt_id is None:
        raise HTTPException(status_code=422, detail="attempt_id is required with PAYMENT-SIGNATURE")
    if facilitator is None:
        raise HTTPException(status_code=503, detail="x402 facilitator is not configured")
    attempts = await gateway.select(
        "payment_attempts",
        access_token=token,
        filters={
            "select": (
                "id,payment_request_id,status,payment_requirements,payment_payload_hash,tx_hash"
            ),
            "id": f"eq.{payload.attempt_id}",
            "limit": "1",
        },
    )
    if not attempts:
        raise HTTPException(status_code=404, detail="payment attempt not found")
    attempt = attempts[0]
    if attempt.get("payment_request_id") != str(request_id):
        raise HTTPException(status_code=404, detail="payment attempt not found")
    requirements = attempt.get("payment_requirements")
    if not isinstance(requirements, dict):
        raise HTTPException(status_code=409, detail="payment attempt has no x402 requirements")
    try:
        payment_payload = decode_payment_header(signature)
    except ValueError as error:
        return _error_402(str(error), requirements)
    accepted = requirements.get("accepts")
    if (
        payment_payload.get("x402Version") != 2
        or not isinstance(accepted, list)
        or not accepted
        or payment_payload.get("accepted") != accepted[0]
        or not isinstance(payment_payload.get("payload"), dict)
    ):
        return _error_402("PAYMENT-SIGNATURE does not match the prepared payment", requirements)

    payload_hash = payment_payload_hash(payment_payload)
    existing_hash = attempt.get("payment_payload_hash")
    if existing_hash is not None:
        if existing_hash != payload_hash:
            raise HTTPException(
                status_code=409, detail="PAYMENT-SIGNATURE differs from consumed attempt"
            )
        if attempt.get("status") == "confirmed":
            return JSONResponse(
                status_code=200,
                content={
                    "attempt_id": str(payload.attempt_id),
                    "status": "confirmed",
                    "tx_hash": attempt.get("tx_hash"),
                    "next_action": "complete",
                },
            )
        if attempt.get("status") == "submitted":
            return JSONResponse(
                status_code=202,
                content={
                    "attempt_id": str(payload.attempt_id),
                    "status": "submitted",
                    "tx_hash": attempt.get("tx_hash"),
                    "next_action": "reconcile",
                },
            )
        if attempt.get("status") == "unknown":
            return JSONResponse(
                status_code=202,
                content={
                    "attempt_id": str(payload.attempt_id),
                    "status": "unknown",
                    "next_action": "reconcile",
                },
            )

    try:
        await gateway.rpc(
            "consume_payment_attempt",
            {"p_attempt_id": str(payload.attempt_id), "p_payment_payload_hash": payload_hash},
            access_token=token,
        )
        verification = await facilitator.verify(
            payment_payload=payment_payload,
            requirements=requirements,
        )
        if not verification.is_valid:
            await gateway.rpc(
                "record_payment_failure",
                {
                    "p_attempt_id": str(payload.attempt_id),
                    "p_error_code": (
                        verification.invalid_reason or "facilitator_verification_failed"
                    ),
                },
                access_token=token,
            )
            return _error_402(
                verification.invalid_reason or "facilitator rejected the payment",
                requirements,
            )
        settlement = await facilitator.settle(
            payment_payload=payment_payload,
            requirements=requirements,
        )
    except AmbiguousSettlementError:
        await gateway.rpc(
            "record_payment_unknown",
            {"p_attempt_id": str(payload.attempt_id), "p_error_code": "facilitator_timeout"},
            access_token=token,
        )
        return JSONResponse(
            status_code=202,
            content={
                "attempt_id": str(payload.attempt_id),
                "status": "unknown",
                "next_action": "reconcile",
            },
        )
    except SupabaseApiError as error:
        raise HTTPException(
            status_code=_preparation_status(error), detail="Settlement state update failed"
        ) from error
    except ValueError as error:
        await gateway.rpc(
            "record_payment_failure",
            {
                "p_attempt_id": str(payload.attempt_id),
                "p_error_code": "facilitator_malformed_response",
            },
            access_token=token,
        )
        raise HTTPException(status_code=502, detail=str(error)) from error

    if (
        not settlement.success
        or settlement.transaction is None
        or settlement.network != "stellar:testnet"
    ):
        await gateway.rpc(
            "record_payment_failure",
            {
                "p_attempt_id": str(payload.attempt_id),
                "p_error_code": settlement.error_reason or "facilitator_settlement_failed",
            },
            access_token=token,
        )
        return _error_402(settlement.error_reason or "facilitator settlement failed", requirements)

    await gateway.rpc(
        "record_payment_submission",
        {
            "p_attempt_id": str(payload.attempt_id),
            "p_tx_hash": settlement.transaction,
            "p_provider_reference": settlement.payer,
        },
        access_token=token,
    )
    response_payload = {
        "success": True,
        "transaction": settlement.transaction,
        "network": settlement.network,
        "payer": settlement.payer,
    }
    return JSONResponse(
        status_code=202,
        content={
            "attempt_id": str(payload.attempt_id),
            "status": "submitted",
            "tx_hash": settlement.transaction,
            "next_action": "reconcile",
        },
        headers={"PAYMENT-RESPONSE": encode_payment_header(response_payload)},
    )


@router.post(
    "/payment-requests/{request_id}/settle",
    response_model=SettlementPreparedResponse,
)
async def settle_payment_request(
    request_id: UUID,
    payload: SettlementPrepareRequest,
    request: Request,
    _actor: ActorDependency,
    token: TokenDependency,
    idempotency_key: IdempotencyHeader,
    gateway: GatewayDependency,
    payment_signature: PaymentSignatureHeader = None,
) -> JSONResponse:
    if idempotency_key is None:
        raise HTTPException(status_code=422, detail="Idempotency-Key is required")
    if payment_signature is not None:
        return await _settle_signed_payment(
            request_id=request_id,
            payload=payload,
            signature=payment_signature,
            token=token,
            idempotency_key=idempotency_key,
            gateway=gateway,
            facilitator=request.app.state.x402_facilitator,
        )
    settings = request.app.state.settings
    try:
        prepared = await SettlementPreparationService(
            gateway,
            max_timeout_seconds=settings.x402_max_timeout_seconds,
        ).prepare(
            request_id=request_id,
            expected_version=payload.expected_version,
            attempt_id=payload.attempt_id,
            idempotency_key=idempotency_key,
            access_token=token,
            resource_url=str(request.url),
        )
    except SupabaseApiError as error:
        raise HTTPException(
            status_code=_preparation_status(error), detail="Settlement preparation failed"
        ) from error
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    response = {
        "attempt_id": prepared["attempt_id"],
        "payment_request_id": prepared["payment_request_id"],
        "status": prepared["status"],
        "next_action": "sign_x402",
        "preparation_expires_at": prepared["preparation_expires_at"],
    }
    return JSONResponse(
        status_code=402,
        content=response,
        headers={"PAYMENT-REQUIRED": _requirements_header(prepared["payment_requirements"])},
    )


@router.post("/payment-attempts/{attempt_id}/refresh")
async def refresh_payment_attempt(
    attempt_id: UUID,
    request: Request,
    actor: ActorDependency,
    token: TokenDependency,
    idempotency_key: IdempotencyHeader,
    gateway: GatewayDependency,
) -> JSONResponse:
    if idempotency_key is None:
        raise HTTPException(status_code=422, detail="Idempotency-Key is required")
    reader = request.app.state.stellar_rpc
    if reader is None:
        raise HTTPException(status_code=503, detail="Stellar reconciliation is not configured")
    try:
        result = await PaymentReconciliationService(gateway, reader).reconcile(
            attempt_id=attempt_id,
            actor_id=actor.subject,
            access_token=token,
        )
    except SupabaseApiError as error:
        raise HTTPException(
            status_code=_preparation_status(error), detail="Reconciliation state update failed"
        ) from error
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except PermissionError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    status_code = 200 if result["status"] in {"confirmed", "failed"} else 202
    return JSONResponse(status_code=status_code, content=result)
