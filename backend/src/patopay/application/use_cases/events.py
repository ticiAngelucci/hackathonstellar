from datetime import datetime
from typing import Any
from uuid import UUID

from patopay.domain.models import Event, EventStatus, Participant
from patopay.infrastructure.supabase.gateway import SupabaseTableGateway


class SupabaseEventService:
    def __init__(self, gateway: SupabaseTableGateway) -> None:
        self._gateway = gateway

    async def create_event(
        self,
        *,
        name: str,
        access_token: str,
    ) -> Event:
        payload = await self._gateway.rpc(
            "create_event_with_owner",
            {"p_name": name},
            access_token=access_token,
        )
        if not isinstance(payload, dict):
            raise ValueError("Supabase event RPC returned an invalid payload")
        return self._to_event(payload)

    async def list_events(self, *, access_token: str) -> list[Event]:
        rows = await self._gateway.select(
            "events",
            access_token=access_token,
            filters={
                "select": "id,owner_id,name,status,created_at",
                "order": "created_at.asc,id.asc",
            },
        )
        events: list[Event] = []
        for row in rows:
            participants = await self._participants(
                event_id=str(row["id"]),
                access_token=access_token,
            )
            events.append(self._to_event(row, participants=participants))
        return events

    async def _participants(self, *, event_id: str, access_token: str) -> list[Participant]:
        rows = await self._gateway.select(
            "event_participants",
            access_token=access_token,
            filters={
                "select": "user_id,profiles(display_name)",
                "event_id": f"eq.{event_id}",
                "order": "joined_at.asc",
            },
        )
        participants: list[Participant] = []
        for row in rows:
            profile = row.get("profiles") or {}
            participants.append(
                Participant(
                    user_id=UUID(str(row["user_id"])),
                    display_name=str(profile.get("display_name") or ""),
                )
            )
        return participants

    @staticmethod
    def _to_event(
        row: dict[str, Any],
        *,
        participants: list[Participant] | None = None,
    ) -> Event:
        raw_created_at = str(row["created_at"])
        created_at = datetime.fromisoformat(raw_created_at.replace("Z", "+00:00"))
        raw_participants = row.get("participants")
        if participants is None and isinstance(raw_participants, list):
            participants = [
                Participant(
                    user_id=UUID(str(item["user_id"])),
                    display_name=str(item.get("display_name") or ""),
                )
                for item in raw_participants
            ]
        return Event(
            id=UUID(str(row["id"])),
            name=str(row["name"]),
            creator_id=UUID(str(row["owner_id"])),
            status=EventStatus(str(row["status"])),
            created_at=created_at,
            participants=participants or [],
        )
