from __future__ import annotations

from collections.abc import Mapping
from typing import Any

import httpx

from patopay.config import Settings


class SupabaseApiError(RuntimeError):
    def __init__(self, status_code: int) -> None:
        super().__init__(f"Supabase API request failed with status {status_code}")
        self.status_code = status_code


class SupabaseClient:
    def __init__(
        self,
        settings: Settings,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._publishable_key = settings.supabase_publishable_key
        self._client = httpx.AsyncClient(
            base_url=settings.supabase_url.rstrip("/"),
            headers={"apikey": self._publishable_key} if self._publishable_key else {},
            timeout=settings.supabase_timeout_seconds,
            transport=transport,
        )

    async def check_connection(self) -> None:
        await self.request("/rest/v1/")

    async def request(
        self,
        path: str,
        *,
        method: str = "GET",
        access_token: str | None = None,
        params: Mapping[str, str] | None = None,
        json: Any = None,
        extra_headers: Mapping[str, str] | None = None,
    ) -> Any:
        if not self._publishable_key:
            raise ValueError("Supabase publishable key is required")

        headers: dict[str, str] = {"Accept": "application/json"}
        if extra_headers is not None:
            headers.update(extra_headers)
        if access_token is not None:
            headers["Authorization"] = f"Bearer {access_token}"
        response = await self._client.request(
            method,
            path,
            headers=headers,
            params=params,
            json=json,
        )
        if not response.is_success:
            raise SupabaseApiError(response.status_code)
        if not response.content:
            return None
        return response.json()

    async def dispose(self) -> None:
        await self._client.aclose()
