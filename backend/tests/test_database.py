from patopay.config import Settings
from patopay.infrastructure.postgres.database import Database, normalize_database_url


def test_normalize_database_url_adds_psycopg_driver() -> None:
    url = "postgresql://user:password@example.com:5432/postgres"

    assert normalize_database_url(url) == (
        "postgresql+psycopg://user:password@example.com:5432/postgres"
    )


def test_normalize_database_url_preserves_existing_driver() -> None:
    url = "postgresql+psycopg://user:password@example.com:5432/postgres"

    assert normalize_database_url(url) == url


def test_database_exposes_non_expiring_session_factory() -> None:
    database = Database(
        Settings(
            env="test",
            database_url="postgresql://runtime:password@example.com:5432/postgres",
        )
    )

    assert database.session_factory.kw["expire_on_commit"] is False
