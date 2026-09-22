import pytest
from sqlalchemy import text

from patopay.infrastructure.postgres.unit_of_work import PostgresUnitOfWork

pytestmark = pytest.mark.integration


async def test_subject_is_transaction_local(unit_of_work: object) -> None:
    async with unit_of_work as work:  # type: ignore[attr-defined]
        result = await work.session.execute(
            text("select current_setting('request.jwt.claim.sub', true)")
        )
        assert result.scalar_one() == "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"


async def test_rollback_discards_inserted_rows(unit_of_work: object) -> None:
    async with unit_of_work as work:  # type: ignore[attr-defined]
        await work.session.execute(text("select 1"))
        await work.rollback()


async def test_subject_does_not_leak_between_pool_sessions(session_factory: object) -> None:
    first = PostgresUnitOfWork(
        session_factory=session_factory,  # type: ignore[arg-type]
        subject_id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    )
    async with first as work:
        result = await work.session.execute(
            text("select current_setting('request.jwt.claim.sub', true)")
        )
        assert result.scalar_one() == "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

    second = PostgresUnitOfWork(
        session_factory=session_factory,  # type: ignore[arg-type]
        subject_id="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    )
    async with second as work:
        result = await work.session.execute(
            text("select current_setting('request.jwt.claim.sub', true)")
        )
        assert result.scalar_one() == "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
