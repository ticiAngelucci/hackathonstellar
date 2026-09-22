from typing import Any, cast
from uuid import UUID

from sqlalchemy import update
from sqlalchemy.engine import CursorResult
from sqlalchemy.ext.asyncio import AsyncSession

from patopay.infrastructure.postgres.models import (
    AssetModel,
    PaymentAttemptModel,
    PaymentDecisionModel,
    PaymentPolicyVersionModel,
    PaymentRequestModel,
    ProfileModel,
    WalletModel,
)


class ProfileRepositoryImpl:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, profile_id: UUID) -> ProfileModel | None:
        return await self.session.get(ProfileModel, profile_id)

    async def add(self, profile: ProfileModel) -> None:
        self.session.add(profile)


class AssetRepositoryImpl:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, asset_id: UUID) -> AssetModel | None:
        return await self.session.get(AssetModel, asset_id)

    async def add(self, asset: AssetModel) -> None:
        self.session.add(asset)


class WalletRepositoryImpl:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, wallet_id: UUID) -> WalletModel | None:
        return await self.session.get(WalletModel, wallet_id)

    async def add(self, wallet: WalletModel) -> None:
        self.session.add(wallet)


class PaymentPolicyRepositoryImpl:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, policy_id: UUID) -> PaymentPolicyVersionModel | None:
        return await self.session.get(PaymentPolicyVersionModel, policy_id)

    async def add(self, policy: PaymentPolicyVersionModel) -> None:
        self.session.add(policy)


class PaymentRequestRepositoryImpl:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, request_id: UUID) -> PaymentRequestModel | None:
        return await self.session.get(PaymentRequestModel, request_id)

    async def add(self, request: PaymentRequestModel) -> None:
        self.session.add(request)

    async def update_status(self, request_id: UUID, expected_version: int, status: str) -> bool:
        result = cast(
            CursorResult[Any],
            await self.session.execute(
                update(PaymentRequestModel)
                .where(
                    PaymentRequestModel.id == request_id,
                    PaymentRequestModel.version == expected_version,
                )
                .values(status=status, version=expected_version + 1)
            ),
        )
        return bool(result.rowcount == 1)


class PaymentDecisionRepositoryImpl:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def add(self, decision: PaymentDecisionModel) -> None:
        self.session.add(decision)


class PaymentAttemptRepositoryImpl:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def add(self, attempt: PaymentAttemptModel) -> None:
        self.session.add(attempt)


__all__ = [
    "AssetRepositoryImpl",
    "PaymentAttemptRepositoryImpl",
    "PaymentDecisionRepositoryImpl",
    "PaymentPolicyRepositoryImpl",
    "PaymentRequestRepositoryImpl",
    "ProfileRepositoryImpl",
    "WalletRepositoryImpl",
]
