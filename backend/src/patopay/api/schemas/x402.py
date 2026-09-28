from typing import Literal

from pydantic import ConfigDict, Field

from patopay.api.schemas import ApiModel


class X402Model(ApiModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class X402Accepted(X402Model):
    scheme: Literal["exact"] = "exact"
    network: Literal["stellar:testnet"] = "stellar:testnet"
    amount: str = Field(min_length=1)
    asset: str = Field(min_length=1)
    pay_to: str = Field(alias="payTo", min_length=1)
    max_timeout_seconds: int = Field(alias="maxTimeoutSeconds", ge=15, le=300)
    extra: dict[str, object] = Field(default_factory=dict)


class X402Resource(X402Model):
    url: str = Field(min_length=1)
    description: str = Field(min_length=1)
    mime_type: Literal["application/json"] = Field(default="application/json", alias="mimeType")


class X402PaymentRequired(X402Model):
    x402_version: Literal[2] = Field(default=2, alias="x402Version")
    error: str = "PAYMENT-SIGNATURE header is required"
    resource: X402Resource
    accepts: list[X402Accepted] = Field(min_length=1)
