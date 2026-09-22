from typing import Protocol
from uuid import UUID

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


class ProfileRepository(Protocol):
    async def get(self, profile_id: UUID) -> ProfileModel | None: ...

    async def add(self, profile: ProfileModel) -> None: ...


class AssetRepository(Protocol):
    async def get(self, asset_id: UUID) -> AssetModel | None: ...

    async def add(self, asset: AssetModel) -> None: ...


class WalletRepository(Protocol):
    async def get(self, wallet_id: UUID) -> WalletModel | None: ...

    async def add(self, wallet: WalletModel) -> None: ...


class PaymentPolicyRepository(Protocol):
    async def get(self, policy_id: UUID) -> PaymentPolicyVersionModel | None: ...

    async def add(self, policy: PaymentPolicyVersionModel) -> None: ...


class PaymentRequestRepository(Protocol):
    async def get(self, request_id: UUID) -> PaymentRequestModel | None: ...

    async def add(self, request: PaymentRequestModel) -> None: ...

    async def update_status(self, request_id: UUID, expected_version: int, status: str) -> bool: ...


class PaymentDecisionRepository(Protocol):
    async def add(self, decision: PaymentDecisionModel) -> None: ...


class PaymentAttemptRepository(Protocol):
    async def add(self, attempt: PaymentAttemptModel) -> None: ...


class RepositoryFactory(Protocol):
    session: AsyncSession
    profiles: ProfileRepository
    assets: AssetRepository
    wallets: WalletRepository
    policies: PaymentPolicyRepository
    payment_requests: PaymentRequestRepository
    decisions: PaymentDecisionRepository
    attempts: PaymentAttemptRepository
