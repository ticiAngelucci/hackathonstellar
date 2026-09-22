from __future__ import annotations

from datetime import datetime
from typing import Any, ClassVar
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, Boolean, DateTime, Integer, SmallInteger, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


Timestamp = DateTime(timezone=True)


class ProfileModel(Base):
    __tablename__ = "profiles"
    __table_args__: ClassVar = {"schema": "patopay"}  # type: ignore[misc]

    id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), primary_key=True)
    username: Mapped[str | None] = mapped_column(String(120), unique=True)
    display_name: Mapped[str | None] = mapped_column(String(120))
    notifications_enabled: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=text("true")
    )
    created_at: Mapped[datetime] = mapped_column(Timestamp, server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(Timestamp, server_default=text("now()"))


class EventModel(Base):
    __tablename__ = "events"
    __table_args__: ClassVar = {"schema": "patopay"}  # type: ignore[misc]

    id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    owner_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), nullable=False)
    name: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(16), default="draft", server_default=text("'draft'"))
    version: Mapped[int] = mapped_column(Integer, default=1, server_default=text("1"))
    created_at: Mapped[datetime] = mapped_column(Timestamp, server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(Timestamp, server_default=text("now()"))


class EventParticipantModel(Base):
    __tablename__ = "event_participants"
    __table_args__: ClassVar = {"schema": "patopay"}  # type: ignore[misc]

    event_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), primary_key=True)
    user_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), primary_key=True)
    role: Mapped[str] = mapped_column(String(16))
    joined_at: Mapped[datetime] = mapped_column(Timestamp, server_default=text("now()"))


class AssetModel(Base):
    __tablename__ = "assets"
    __table_args__: ClassVar = {"schema": "patopay"}  # type: ignore[misc]

    id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    network: Mapped[str] = mapped_column(String(32))
    contract_address: Mapped[str] = mapped_column(String(64))
    code: Mapped[str] = mapped_column(String(12))
    decimals: Mapped[int] = mapped_column(SmallInteger)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(Timestamp, server_default=text("now()"))


class WalletModel(Base):
    __tablename__ = "wallets"
    __table_args__: ClassVar = {"schema": "patopay"}  # type: ignore[misc]

    id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), nullable=False)
    provider: Mapped[str] = mapped_column(String(16))
    network: Mapped[str] = mapped_column(String(16))
    contract_address: Mapped[str] = mapped_column(String(128))
    wallet_wasm_hash: Mapped[str | None] = mapped_column(String(128))
    creation_tx_hash: Mapped[str | None] = mapped_column(String(128))
    status: Mapped[str] = mapped_column(
        String(16), default="unverified", server_default=text("'unverified'")
    )
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    version: Mapped[int] = mapped_column(Integer, default=1, server_default=text("1"))
    created_at: Mapped[datetime] = mapped_column(Timestamp, server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(Timestamp, server_default=text("now()"))


class MockWalletBalanceModel(Base):
    __tablename__ = "mock_wallet_balances"
    __table_args__: ClassVar = {"schema": "patopay"}  # type: ignore[misc]

    wallet_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), primary_key=True)
    balance_minor: Mapped[int] = mapped_column(BigInteger, default=0, server_default=text("0"))
    observed_at: Mapped[datetime] = mapped_column(Timestamp, server_default=text("now()"))


class PaymentPolicyVersionModel(Base):
    __tablename__ = "payment_policy_versions"
    __table_args__: ClassVar = {"schema": "patopay"}  # type: ignore[misc]

    id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), nullable=False)
    version: Mapped[int] = mapped_column(Integer)
    auto_pay_limit_minor: Mapped[int] = mapped_column(BigInteger)
    approval_limit_minor: Mapped[int] = mapped_column(BigInteger)
    daily_limit_minor: Mapped[int] = mapped_column(BigInteger)
    recipient_mode: Mapped[str] = mapped_column(String(16))
    policy_contract_address: Mapped[str | None] = mapped_column(String(64))
    on_chain_revision: Mapped[int | None] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(Timestamp, server_default=text("now()"))


class PolicyAllowedRecipientModel(Base):
    __tablename__ = "policy_allowed_recipients"
    __table_args__: ClassVar = {"schema": "patopay"}  # type: ignore[misc]

    policy_version_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), primary_key=True)
    recipient_profile_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), primary_key=True)


class PolicyAllowedAssetModel(Base):
    __tablename__ = "policy_allowed_assets"
    __table_args__: ClassVar = {"schema": "patopay"}  # type: ignore[misc]

    policy_version_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), primary_key=True)
    asset_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), primary_key=True)


class ServiceSubscriptionModel(Base):
    __tablename__ = "service_subscriptions"
    __table_args__: ClassVar = {"schema": "patopay"}  # type: ignore[misc]

    user_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), primary_key=True)
    service_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    updated_at: Mapped[datetime] = mapped_column(Timestamp, server_default=text("now()"))


class PaymentRequestModel(Base):
    __tablename__ = "payment_requests"
    __table_args__: ClassVar = {"schema": "patopay"}  # type: ignore[misc]

    id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    requester_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), nullable=False)
    payer_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), nullable=False)
    source_wallet_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), nullable=False)
    destination_wallet_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), nullable=False)
    asset_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), nullable=False)
    amount_minor: Mapped[int] = mapped_column(BigInteger)
    memo: Mapped[str | None] = mapped_column(Text)
    policy_version_id: Mapped[UUID | None] = mapped_column(PostgresUUID(as_uuid=True))
    policy_snapshot: Mapped[dict[str, Any]] = mapped_column(
        JSONB, default=dict, server_default=text("'{}'::jsonb")
    )
    status: Mapped[str] = mapped_column(String(24))
    version: Mapped[int] = mapped_column(Integer, default=1, server_default=text("1"))
    created_at: Mapped[datetime] = mapped_column(Timestamp, server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(Timestamp, server_default=text("now()"))


class PaymentDecisionModel(Base):
    __tablename__ = "policy_decisions"
    __table_args__: ClassVar = {"schema": "patopay"}  # type: ignore[misc]

    id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    payment_request_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), nullable=False)
    actor_id: Mapped[UUID | None] = mapped_column(PostgresUUID(as_uuid=True))
    source: Mapped[str] = mapped_column(String(16))
    action: Mapped[str] = mapped_column(String(16))
    outcome: Mapped[str] = mapped_column(String(32))
    reason_code: Mapped[str] = mapped_column(String(64))
    policy_snapshot: Mapped[dict[str, Any]] = mapped_column(
        JSONB, default=dict, server_default=text("'{}'::jsonb")
    )
    created_at: Mapped[datetime] = mapped_column(Timestamp, server_default=text("now()"))


class PaymentAttemptModel(Base):
    __tablename__ = "payment_attempts"
    __table_args__: ClassVar = {"schema": "patopay"}  # type: ignore[misc]

    id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    payment_request_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), nullable=False)
    attempt_number: Mapped[int] = mapped_column(Integer)
    executor: Mapped[str] = mapped_column(String(16))
    mode: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(16))
    preparation_hash: Mapped[str | None] = mapped_column(String(128))
    preparation_expires_at: Mapped[datetime | None] = mapped_column(Timestamp)
    consumed_at: Mapped[datetime | None] = mapped_column(Timestamp)
    envelope_hash: Mapped[str | None] = mapped_column(String(128))
    tx_hash: Mapped[str | None] = mapped_column(String(128), unique=True)
    provider_reference: Mapped[str | None] = mapped_column(String(128))
    ledger: Mapped[int | None] = mapped_column(BigInteger)
    receipt: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    error_code: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(Timestamp, server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(Timestamp, server_default=text("now()"))


class IdempotencyKeyModel(Base):
    __tablename__ = "idempotency_keys"
    __table_args__: ClassVar = {"schema": "patopay"}  # type: ignore[misc]

    actor_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), primary_key=True)
    method: Mapped[str] = mapped_column(String(12), primary_key=True)
    path: Mapped[str] = mapped_column(String(256), primary_key=True)
    key: Mapped[str] = mapped_column(String(128), primary_key=True)
    request_hash: Mapped[str] = mapped_column(String(128))
    response_status: Mapped[int | None] = mapped_column(SmallInteger)
    response_body: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(Timestamp, server_default=text("now()"))
