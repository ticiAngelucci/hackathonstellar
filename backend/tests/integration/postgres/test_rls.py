import os
from collections.abc import AsyncIterator

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

pytestmark = pytest.mark.integration


@pytest.fixture
async def runtime_session() -> AsyncIterator[AsyncSession]:
    url = os.getenv("PATOPAY_RUNTIME_DATABASE_URL")
    if not url:
        pytest.skip("PATOPAY_RUNTIME_DATABASE_URL is required for RLS integration tests")
    engine = create_async_engine(url, pool_pre_ping=True)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()


async def test_runtime_subject_is_transaction_local(runtime_session: AsyncSession) -> None:
    await runtime_session.execute(text("begin"))
    await runtime_session.execute(
        text("select set_config('request.jwt.claim.sub', :subject, true)"),
        {"subject": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"},
    )
    result = await runtime_session.execute(
        text("select current_setting('request.jwt.claim.sub', true)")
    )
    assert result.scalar_one() == "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    await runtime_session.rollback()


async def test_runtime_cannot_create_private_schema_objects(runtime_session: AsyncSession) -> None:
    result = await runtime_session.execute(
        text("select has_schema_privilege(current_user, 'patopay', 'create')")
    )
    assert result.scalar_one() is False
