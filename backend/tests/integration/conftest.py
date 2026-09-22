import os
from collections.abc import AsyncIterator

import pytest
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from patopay.infrastructure.postgres.unit_of_work import PostgresUnitOfWork


@pytest.fixture(scope="session")
def test_database_url() -> str:
    value = os.getenv("PATOPAY_TEST_DATABASE_URL")
    if not value:
        pytest.skip("PATOPAY_TEST_DATABASE_URL is required for PostgreSQL integration tests")
    return value


@pytest.fixture(scope="session")
async def test_engine(test_database_url: str) -> AsyncIterator[AsyncEngine]:
    engine = create_async_engine(test_database_url, pool_pre_ping=True)
    yield engine
    await engine.dispose()


@pytest.fixture
def session_factory(test_engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(test_engine, expire_on_commit=False)


@pytest.fixture
def unit_of_work(session_factory: async_sessionmaker[AsyncSession]) -> PostgresUnitOfWork:
    return PostgresUnitOfWork(
        session_factory=session_factory,
        subject_id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    )
