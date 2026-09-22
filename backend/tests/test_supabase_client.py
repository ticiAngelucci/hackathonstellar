import httpx
import pytest

from patopay.config import Settings
from patopay.infrastructure.supabase.client import SupabaseClient
from patopay.infrastructure.supabase.gateway import SupabaseTableGateway


async def test_supabase_client_uses_publishable_key_for_readiness() -> None:
    requests: list[httpx.Request] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json={"swagger": "2.0"})

    client = SupabaseClient(
        Settings(env="test", supabase_publishable_key="publishable-test-key"),
        transport=httpx.MockTransport(handler),
    )

    await client.check_connection()

    assert requests[0].url.path == "/rest/v1/"
    assert requests[0].headers["apikey"] == "publishable-test-key"
    assert "authorization" not in requests[0].headers
    await client.dispose()


async def test_supabase_client_forwards_user_jwt_to_postgrest() -> None:
    captured: list[httpx.Request] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(200, json=[{"id": "profile-1"}])

    client = SupabaseClient(
        Settings(env="test", supabase_publishable_key="publishable-test-key"),
        transport=httpx.MockTransport(handler),
    )

    result = await client.request(
        "/rest/v1/profiles",
        access_token="user-jwt",
        params={"id": "eq.profile-1"},
    )

    assert result == [{"id": "profile-1"}]
    assert captured[0].headers["authorization"] == "Bearer user-jwt"
    await client.dispose()


async def test_supabase_client_requires_publishable_key() -> None:
    client = SupabaseClient(Settings(env="test"))

    with pytest.raises(ValueError, match="publishable key"):
        await client.check_connection()

    await client.dispose()


async def test_supabase_table_gateway_reads_through_postgrest_with_user_jwt() -> None:
    requests: list[httpx.Request] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json=[{"id": "profile-1"}])

    client = SupabaseClient(
        Settings(env="test", supabase_publishable_key="publishable-test-key"),
        transport=httpx.MockTransport(handler),
    )
    gateway = SupabaseTableGateway(client)

    result = await gateway.select(
        "profiles",
        access_token="user-jwt",
        filters={"id": "eq.profile-1"},
    )

    assert result == [{"id": "profile-1"}]
    assert requests[0].url.path == "/rest/v1/profiles"
    assert requests[0].url.params["id"] == "eq.profile-1"
    assert requests[0].headers["authorization"] == "Bearer user-jwt"
    assert requests[0].headers["accept-profile"] == "patopay"
    await client.dispose()


async def test_supabase_table_gateway_sends_content_profile_for_mutations() -> None:
    requests: list[httpx.Request] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(201, json=[{"id": "profile-1"}])

    client = SupabaseClient(
        Settings(env="test", supabase_publishable_key="publishable-test-key"),
        transport=httpx.MockTransport(handler),
    )
    gateway = SupabaseTableGateway(client)

    await gateway.insert("profiles", {"id": "profile-1"}, access_token="user-jwt")

    assert requests[0].headers["content-profile"] == "patopay"
    await client.dispose()
