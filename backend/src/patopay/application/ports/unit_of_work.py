from typing import Protocol

from sqlalchemy.ext.asyncio import AsyncSession


class UnitOfWork(Protocol):
    session: AsyncSession

    async def __aenter__(self) -> "UnitOfWork": ...

    async def __aexit__(self, exc_type: object, exc_value: object, traceback: object) -> None: ...

    async def commit(self) -> None: ...

    async def rollback(self) -> None: ...
