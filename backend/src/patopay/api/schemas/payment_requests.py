from uuid import UUID

from pydantic import Field, field_validator

from patopay.api.schemas import ApiModel


class PaymentRequestCreate(ApiModel):
    payer_profile_id: UUID
    amount_minor: str
    asset_id: UUID
    memo: str | None = Field(default=None, max_length=500)

    @field_validator("amount_minor", mode="before")
    @classmethod
    def validate_amount_minor(cls, value: object) -> str:
        if (
            type(value) is not str
            or not value.isdigit()
            or (len(value) > 1 and value.startswith("0"))
        ):
            raise ValueError("amount_minor must be a canonical decimal string")
        if int(value) < 1 or int(value) > 9_000_000_000_000_000:
            raise ValueError("amount_minor is outside the supported range")
        return value


class PaymentRequestResponse(ApiModel):
    id: UUID
    status: str
    policy_outcome: str
    reason_code: str
    next_action: str | None
    amount_minor: str
    asset_id: UUID


class PaymentRequestSummary(ApiModel):
    id: UUID
    requester_id: UUID
    payer_id: UUID
    asset_id: UUID
    amount_minor: str
    memo: str | None
    status: str
