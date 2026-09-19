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
