from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any

from patopay.infrastructure.supabase.client import SupabaseClient

_IDENTIFIER = re.compile(r"^[a-z_][a-z0-9_]*$")


class SupabaseTableGateway:
    def __init__(self, client: SupabaseClient) -> None:
        self._client = client

    async def select(
        self,
        table: str,
        *,
        access_token: str,
        filters: Mapping[str, str] | None = None,
    ) -> list[dict[str, Any]]:
        result = await self._client.request(
            self._table_path(table),
            access_token=access_token,
            params=filters,
        )
        if not isinstance(result, list):
            raise ValueError("Supabase table response must be a list")
        return result

    async def insert(
        self,
        table: str,
        record: Mapping[str, Any],
        *,
        access_token: str,
    ) -> Any:
        return await self._client.request(
            self._table_path(table),
            method="POST",
            access_token=access_token,
            json=dict(record),
            extra_headers={"Prefer": "return=representation"},
        )

    async def update(
        self,
        table: str,
        record: Mapping[str, Any],
        *,
        access_token: str,
        filters: Mapping[str, str],
    ) -> Any:
        return await self._client.request(
            self._table_path(table),
            method="PATCH",
            access_token=access_token,
            params=filters,
            json=dict(record),
            extra_headers={"Prefer": "return=representation"},
        )

    async def rpc(
        self,
        function: str,
        args: Mapping[str, Any],
        *,
        access_token: str,
    ) -> Any:
        if not _IDENTIFIER.fullmatch(function):
            raise ValueError("Supabase RPC function name is invalid")
        return await self._client.request(
            f"/rest/v1/rpc/{function}",
            method="POST",
            access_token=access_token,
            json=dict(args),
        )

    @staticmethod
    def _table_path(table: str) -> str:
        if not _IDENTIFIER.fullmatch(table):
            raise ValueError("Supabase table name is invalid")
        return f"/rest/v1/{table}"
