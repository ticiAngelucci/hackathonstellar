import pytest
from pydantic import ValidationError

from patopay.config import Settings

SUPABASE_URL = "https://ekgfskibieqljhazchno.supabase.co"


def test_settings_point_to_the_team_supabase_project() -> None:
    settings = Settings(
        env="test",
        supabase_url=SUPABASE_URL,
        supabase_project_ref="ekgfskibieqljhazchno",
        supabase_publishable_key="test-publishable-key",
    )

    assert str(settings.supabase_url).rstrip("/") == SUPABASE_URL
    assert settings.supabase_project_ref == "ekgfskibieqljhazchno"
    assert settings.supabase_issuer == f"{SUPABASE_URL}/auth/v1"


def test_settings_have_frontend_development_origins_by_default() -> None:
    settings = Settings(env="test")

    assert "http://localhost:8081" in settings.cors_origins
    assert "http://127.0.0.1:8081" in settings.cors_origins


def test_mock_payment_settings_work_without_stellar_infrastructure() -> None:
    settings = Settings(env="test")

    assert settings.payment_executor == "mock"
    assert settings.stellar_network == "testnet"
    assert settings.stellar_rpc_url is None
    assert settings.stellar_relayer_url is None
    assert settings.stellar_asset_contract_id is None
    assert settings.stellar_asset_code == "USDC"
    assert settings.stellar_asset_scale == 7
    assert settings.supabase_timeout_seconds == 10.0


def test_payment_executor_rejects_unknown_provider() -> None:
    with pytest.raises(ValidationError):
        Settings(env="test", payment_executor="unknown")


def test_stellar_executor_requires_complete_configuration() -> None:
    with pytest.raises(ValidationError, match="Stellar payment configuration is incomplete"):
        Settings(env="test", payment_executor="stellar")


def test_stellar_executor_rejects_invalid_urls() -> None:
    with pytest.raises(ValidationError):
        Settings(
            env="test",
            payment_executor="stellar",
            stellar_rpc_url="not-a-url",
            stellar_relayer_url="also-not-a-url",
            stellar_asset_contract_id="CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        )


def test_stellar_executor_rejects_invalid_asset_contract_id() -> None:
    with pytest.raises(ValidationError):
        Settings(
            env="test",
            payment_executor="stellar",
            stellar_rpc_url="https://soroban-testnet.stellar.org",
            stellar_relayer_url="https://relay.test",
            stellar_asset_contract_id="not-a-contract-id",
        )


def test_settings_do_not_define_a_direct_postgres_connection() -> None:
    settings = Settings(env="test")

    assert not hasattr(settings, "database_url")
    assert not hasattr(settings, "db_pool_size")
    assert not hasattr(settings, "database_sslmode")
