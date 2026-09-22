from functools import cached_property
from typing import Literal

from pydantic import Field, HttpUrl, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="PATOPAY_",
        extra="ignore",
    )

    env: Literal["local", "test", "staging", "production"] = "local"
    app_name: str = "PatoPay API"
    app_version: str = "0.1.0"
    api_prefix: str = "/api/v1"
    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:8081",
            "http://127.0.0.1:8081",
        ]
    )
    supabase_url: str = Field(
        default="https://ekgfskibieqljhazchno.supabase.co",
        pattern=r"^https?://[^/]+(?:/.*)?$",
    )
    supabase_project_ref: str = Field(
        default="ekgfskibieqljhazchno",
        pattern=r"^[a-z0-9]{20}$",
    )
    supabase_publishable_key: str | None = None
    supabase_timeout_seconds: float = Field(default=10.0, gt=0, le=60)
    payment_executor: Literal["mock", "stellar"] = "mock"
    stellar_network: Literal["testnet"] = "testnet"
    stellar_rpc_url: HttpUrl | None = None
    stellar_relayer_url: HttpUrl | None = None
    stellar_asset_contract_id: str | None = Field(
        default=None,
        pattern=r"^C[A-Z2-7]{55}$",
    )
    stellar_asset_code: str = "USDC"
    stellar_asset_scale: int = Field(default=7, ge=0, le=18)

    @model_validator(mode="after")
    def validate_payment_configuration(self) -> "Settings":
        if self.payment_executor == "stellar" and not all(
            (
                self.stellar_rpc_url,
                self.stellar_relayer_url,
                self.stellar_asset_contract_id,
            )
        ):
            raise ValueError("Stellar payment configuration is incomplete")
        return self

    @cached_property
    def supabase_issuer(self) -> str:
        return f"{str(self.supabase_url).rstrip('/')}/auth/v1"
