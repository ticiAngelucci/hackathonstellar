from typing import Any
from uuid import UUID

from patopay.infrastructure.supabase.gateway import SupabaseTableGateway


class ProfileService:
    def __init__(self, gateway: SupabaseTableGateway) -> None:
        self._gateway = gateway

    async def get_me(self, *, actor_id: UUID, access_token: str) -> dict[str, Any]:
        rows = await self._gateway.select(
            "profiles",
            access_token=access_token,
            filters={
                "select": "id,username,display_name,notifications_enabled",
                "id": f"eq.{actor_id}",
                "limit": "1",
            },
        )
        if not rows:
            raise LookupError("profile not found")
        return self._profile_response(rows[0])

    async def upsert_me(
        self,
        *,
        actor_id: UUID,
        access_token: str,
        values: dict[str, Any],
    ) -> dict[str, Any]:
        record = {"id": str(actor_id), **values}
        rows = await self._gateway.insert(
            "profiles",
            record,
            access_token=access_token,
            params={
                "on_conflict": "id",
                "select": "id,username,display_name,notifications_enabled",
            },
        )
        if not isinstance(rows, list) or not rows:
            raise LookupError("profile was not returned by Supabase")
        return self._profile_response(rows[0])

    async def patch_me(
        self,
        *,
        actor_id: UUID,
        access_token: str,
        values: dict[str, Any],
    ) -> dict[str, Any]:
        if not values:
            return await self.get_me(actor_id=actor_id, access_token=access_token)
        rows = await self._gateway.update(
            "profiles",
            values,
            access_token=access_token,
            filters={
                "id": f"eq.{actor_id}",
                "select": "id,username,display_name,notifications_enabled",
            },
        )
        if not isinstance(rows, list) or not rows:
            raise LookupError("profile not found")
        return self._profile_response(rows[0])

    async def lookup_by_username(self, *, username: str, access_token: str) -> dict[str, Any]:
        rows = await self._gateway.select(
            "profiles",
            access_token=access_token,
            filters={
                "select": "id,username,display_name",
                "username": f"eq.{username}",
                "limit": "1",
            },
        )
        if not rows:
            raise LookupError("profile not found")
        return {
            "id": rows[0]["id"],
            "username": rows[0].get("username"),
            "display_name": rows[0].get("display_name"),
        }

    @staticmethod
    def _profile_response(row: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": row["id"],
            "username": row.get("username"),
            "display_name": row.get("display_name"),
            "notifications_enabled": row.get("notifications_enabled", True),
        }
