from functools import cached_property
from typing import Literal

from pydantic import Field
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
    database_url: str | None = None
    db_pool_size: int = Field(default=5, ge=1, le=20)
    db_max_overflow: int = Field(default=5, ge=0, le=20)

    @cached_property
    def supabase_issuer(self) -> str:
        return f"{str(self.supabase_url).rstrip('/')}/auth/v1"
