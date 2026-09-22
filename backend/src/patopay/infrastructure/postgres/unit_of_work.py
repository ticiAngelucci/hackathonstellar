from __future__ import annotations

from collections.abc import Callable
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from patopay.infrastructure.postgres.repositories import (
    AssetRepositoryImpl,
    PaymentAttemptRepositoryImpl,
    PaymentDecisionRepositoryImpl,
    PaymentPolicyRepositoryImpl,
    PaymentRequestRepositoryImpl,
    ProfileRepositoryImpl,
    WalletRepositoryImpl,
)


class PostgresUnitOfWork:
    def __init__(
        self,
        *,
        session_factory: async_sessionmaker[AsyncSession],
        subject_id: UUID | str,
    ) -> None:
        self._session_factory = session_factory
        self.subject_id = UUID(str(subject_id))
        self.session: AsyncSession
        self.profiles: ProfileRepositoryImpl
        self.assets: AssetRepositoryImpl
        self.wallets: WalletRepositoryImpl
        self.policies: PaymentPolicyRepositoryImpl
        self.payment_requests: PaymentRequestRepositoryImpl
        self.decisions: PaymentDecisionRepositoryImpl
        self.attempts: PaymentAttemptRepositoryImpl

    async def __aenter__(self) -> PostgresUnitOfWork:
        self.session = self._session_factory()
        await self.session.execute(
            text("select set_config('request.jwt.claim.sub', :subject, true)"),
            {"subject": str(self.subject_id)},
        )
        self.profiles = ProfileRepositoryImpl(self.session)
        self.assets = AssetRepositoryImpl(self.session)
        self.wallets = WalletRepositoryImpl(self.session)
        self.policies = PaymentPolicyRepositoryImpl(self.session)
        self.payment_requests = PaymentRequestRepositoryImpl(self.session)
        self.decisions = PaymentDecisionRepositoryImpl(self.session)
        self.attempts = PaymentAttemptRepositoryImpl(self.session)
        return self

    async def __aexit__(self, exc_type: object, exc_value: object, traceback: object) -> None:
        if exc_type is not None or self.session.in_transaction():
            await self.session.rollback()
        await self.session.close()

    async def commit(self) -> None:
        await self.session.commit()

    async def rollback(self) -> None:
        await self.session.rollback()


UnitOfWorkFactory = Callable[[UUID | str], PostgresUnitOfWork]


__all__ = ["PostgresUnitOfWork", "UnitOfWorkFactory"]
