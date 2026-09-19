from patopay.infrastructure.postgres.database import normalize_database_url


def test_normalize_database_url_adds_psycopg_driver() -> None:
    url = "postgresql://user:password@example.com:5432/postgres"

    assert normalize_database_url(url) == (
        "postgresql+psycopg://user:password@example.com:5432/postgres"
    )


def test_normalize_database_url_preserves_existing_driver() -> None:
    url = "postgresql+psycopg://user:password@example.com:5432/postgres"

    assert normalize_database_url(url) == url
