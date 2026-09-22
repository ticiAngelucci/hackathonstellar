from uuid import UUID

from pydantic import Field

from patopay.api.schemas import ApiModel


class ProfileUpdate(ApiModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    username: str | None = Field(
        default=None,
        min_length=3,
        max_length=40,
        pattern=r"^[a-z0-9_]+$",
    )
    notifications_enabled: bool | None = None


class ProfileResponse(ApiModel):
    id: UUID
    username: str | None
    display_name: str | None
    notifications_enabled: bool


class PublicProfileResponse(ApiModel):
    id: UUID
    username: str | None
    display_name: str | None
