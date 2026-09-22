import json
from datetime import UTC, datetime, timedelta
from uuid import UUID

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from patopay.config import Settings
from patopay.infrastructure.auth.supabase_jwt import AuthenticationError, SupabaseJwtVerifier

SUPABASE_URL = "https://ekgfskibieqljhazchno.supabase.co"


def make_key_pair() -> tuple[rsa.RSAPrivateKey, dict[str, object]]:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(private_key.public_key()))
    jwk["kid"] = "key-1"
    jwk["alg"] = "RS256"
    return private_key, jwk


def make_token(private_key: rsa.RSAPrivateKey, **overrides: object) -> str:
    now = datetime.now(UTC)
    claims: dict[str, object] = {
        "sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "role": "authenticated",
        "aud": "authenticated",
        "iss": f"{SUPABASE_URL}/auth/v1",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=5)).timestamp()),
    }
    claims.update(overrides)
    return jwt.encode(claims, private_key, algorithm="RS256", headers={"kid": "key-1"})


async def test_valid_supabase_jwt_returns_authenticated_actor() -> None:
    calls = 0
    private_key, jwk = make_key_pair()

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(200, json={"keys": [jwk]})

    verifier = SupabaseJwtVerifier(
        Settings(env="test", supabase_url=SUPABASE_URL),
        transport=httpx.MockTransport(handler),
    )

    actor = await verifier.verify(make_token(private_key))

    assert actor.subject == UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
    assert actor.role == "authenticated"
    assert calls == 1
    await verifier.dispose()


@pytest.mark.parametrize(
    "overrides",
    [
        {"role": "anon"},
        {"aud": "wrong"},
        {"iss": "https://wrong.example/auth/v1"},
        {"sub": "not-a-uuid"},
        {"exp": int((datetime.now(UTC) - timedelta(minutes=1)).timestamp())},
    ],
)
async def test_invalid_supabase_claims_are_rejected(overrides: dict[str, object]) -> None:
    private_key, jwk = make_key_pair()

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"keys": [jwk]})

    verifier = SupabaseJwtVerifier(
        Settings(env="test", supabase_url=SUPABASE_URL),
        transport=httpx.MockTransport(handler),
    )

    with pytest.raises(AuthenticationError):
        await verifier.verify(make_token(private_key, **overrides))

    await verifier.dispose()


async def test_unknown_kid_refreshes_jwks_once() -> None:
    old_private, old_jwk = make_key_pair()
    new_private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    new_jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(new_private.public_key()))
    new_jwk["kid"] = "new-key"
    new_jwk["alg"] = "RS256"
    calls = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(200, json={"keys": [old_jwk] if calls == 1 else [new_jwk]})

    verifier = SupabaseJwtVerifier(
        Settings(env="test", supabase_url=SUPABASE_URL),
        transport=httpx.MockTransport(handler),
    )
    await verifier.verify(make_token(old_private))
    token = jwt.encode(
        {
            "sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            "role": "authenticated",
            "aud": "authenticated",
            "iss": f"{SUPABASE_URL}/auth/v1",
            "iat": int(datetime.now(UTC).timestamp()),
            "exp": int((datetime.now(UTC) + timedelta(minutes=5)).timestamp()),
        },
        new_private,
        algorithm="RS256",
        headers={"kid": "new-key"},
    )

    actor = await verifier.verify(token)

    assert actor.role == "authenticated"
    assert calls == 2
    await verifier.dispose()
