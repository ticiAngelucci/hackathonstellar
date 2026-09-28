from typing import Literal
from uuid import UUID

from pydantic import Field

from patopay.api.schemas import ApiModel


class PaymentDecisionRequest(ApiModel):
    expected_version: int = Field(ge=1)


class PaymentDecisionResponse(ApiModel):
    id: UUID
    status: Literal["approved", "rejected"]
    version: int = Field(ge=1)
    next_action: str | None
