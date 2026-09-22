from typing import Protocol

from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from patopay.config import Settings


class DatabaseHealth(Protocol):
    async def check_connection(self) -> None: ...


class Database:
    def __init__(self, settings: Settings) -> None:
        if not settings.database_url:
            raise ValueError("PATOPAY_DATABASE_URL is required for PostgreSQL")

        self.engine = create_async_engine(
            normalize_database_url(settings.database_url.get_secret_value()),
            pool_pre_ping=True,
            pool_size=settings.db_pool_size,
            max_overflow=settings.db_max_overflow,
        )
        self.session_factory = async_sessionmaker(self.engine, expire_on_commit=False)

    async def check_connection(self) -> None:
        async with self.engine.connect() as connection:
            await connection.execute(text("select 1"))

    async def dispose(self) -> None:
        await self.engine.dispose()


def normalize_database_url(database_url: str) -> str:
    if database_url.startswith("postgres://"):
        return "postgresql+psycopg://" + database_url.removeprefix("postgres://")
    if database_url.startswith("postgresql://"):
        return "postgresql+psycopg://" + database_url.removeprefix("postgresql://")
    if database_url.startswith("postgresql+psycopg://"):
        return database_url
    raise ValueError("PATOPAY_DATABASE_URL must use a PostgreSQL URL")
