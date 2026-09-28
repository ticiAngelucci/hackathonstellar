from uuid import UUID

from pydantic import Field

from patopay.api.schemas import ApiModel


class SettlementPrepareRequest(ApiModel):
    expected_version: int = Field(ge=1)
    attempt_id: UUID | None = None


class SettlementPreparedResponse(ApiModel):
    attempt_id: UUID
    payment_request_id: UUID
    status: str
    next_action: str
    preparation_expires_at: str
