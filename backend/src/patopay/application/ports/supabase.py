from collections.abc import Mapping
from typing import Any, Protocol


class SupabaseGateway(Protocol):
    async def check_connection(self) -> None: ...

    async def request(
        self,
        path: str,
        *,
        method: str = "GET",
        access_token: str | None = None,
        params: Mapping[str, str] | None = None,
        json: Any = None,
    ) -> Any: ...

    async def dispose(self) -> None: ...
