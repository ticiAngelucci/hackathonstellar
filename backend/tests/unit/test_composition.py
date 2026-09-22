import pytest

from patopay.config import Settings
from patopay.infrastructure.postgres.database import Database
from patopay.main import create_app

CONTRACT_ID = "C" + ("A" * 55)


def test_create_app_keeps_explicit_application_dependencies() -> None:
    auth_verifier = object()
    unit_of_work_factory = object()
    payment_executor = object()

    app = create_app(
        auth_verifier=auth_verifier,
        unit_of_work_factory=unit_of_work_factory,
        payment_executor=payment_executor,
    )

    assert app.state.auth_verifier is auth_verifier
    assert app.state.unit_of_work_factory is unit_of_work_factory
    assert app.state.payment_executor is payment_executor


def test_create_app_does_not_fallback_when_stellar_executor_is_missing() -> None:
    settings = Settings(
        env="test",
        payment_executor="stellar",
        stellar_rpc_url="https://soroban-testnet.stellar.org",
        stellar_relayer_url="https://relay.test",
        stellar_asset_contract_id=CONTRACT_ID,
    )

    with pytest.raises(RuntimeError, match="Stellar payment executor is not configured"):
        create_app(settings=settings)


def test_create_app_selects_offline_mock_executor_by_default() -> None:
    app = create_app(settings=Settings(env="test"))

    assert app.state.payment_executor.mode == "mock"


def test_create_app_builds_uow_factory_from_database() -> None:
    database = Database(
        Settings(
            env="test",
            database_url="postgresql://runtime:password@example.com:5432/postgres",
        )
    )

    app = create_app(database=database)

    assert callable(app.state.unit_of_work_factory)
