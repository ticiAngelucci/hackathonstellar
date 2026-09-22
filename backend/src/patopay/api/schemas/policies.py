from typing import Literal
from uuid import UUID

from pydantic import Field

from patopay.api.schemas import ApiModel


class PaymentPolicyUpdate(ApiModel):
    auto_pay_limit_minor: str
    approval_limit_minor: str
    daily_limit_minor: str
    recipient_mode: Literal["any", "allowlist"]
    allowed_recipient_ids: list[UUID] = Field(default_factory=list)
    allowed_asset_ids: list[UUID] = Field(min_length=1)
    expected_version: int = Field(ge=0)


class PaymentPolicyResponse(ApiModel):
    id: UUID
    version: int
    auto_pay_limit_minor: str
    approval_limit_minor: str
    daily_limit_minor: str
    recipient_mode: Literal["any", "allowlist"]
    allowed_recipient_ids: list[UUID]
    allowed_asset_ids: list[UUID]


class ServiceSubscriptionUpdate(ApiModel):
    enabled: bool
