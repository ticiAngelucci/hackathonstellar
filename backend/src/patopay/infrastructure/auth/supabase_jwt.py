from __future__ import annotations

import json
from typing import Any
from uuid import UUID

import httpx
import jwt
from jwt.algorithms import get_default_algorithms

from patopay.application.ports.auth import AuthenticatedActor
from patopay.config import Settings


class AuthenticationError(ValueError):
    """Safe public error for invalid or unavailable authentication."""


class SupabaseJwtVerifier:
    def __init__(
        self,
        settings: Settings,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._issuer = settings.supabase_issuer
        self._jwks_url = f"{self._issuer}/.well-known/jwks.json"
        self._client = httpx.AsyncClient(
            timeout=settings.supabase_timeout_seconds,
            transport=transport,
        )
        self._keys: dict[str, tuple[str, Any]] = {}

    async def verify(self, token: str) -> AuthenticatedActor:
        try:
            header = jwt.get_unverified_header(token)
            algorithm = header.get("alg")
            kid = header.get("kid")
            if algorithm not in {"RS256", "ES256"} or not isinstance(kid, str):
                raise AuthenticationError("invalid token header")

            key = self._keys.get(kid)
            if key is None:
                await self._refresh_keys()
                key = self._keys.get(kid)
            if key is None:
                await self._refresh_keys()
                key = self._keys.get(kid)
            if key is None or key[0] != algorithm:
                raise AuthenticationError("unknown token key")

            claims = jwt.decode(
                token,
                key[1],
                algorithms=[algorithm],
                audience="authenticated",
                issuer=self._issuer,
                options={"require": ["exp", "sub", "aud", "iss"]},
            )
            subject = UUID(str(claims["sub"]))
            if claims.get("role") != "authenticated":
                raise AuthenticationError("anonymous session is not accepted")
            email = claims.get("email")
            return AuthenticatedActor(
                subject=subject,
                role="authenticated",
                email=email if isinstance(email, str) else None,
            )
        except AuthenticationError:
            raise
        except (KeyError, TypeError, ValueError, jwt.PyJWTError, httpx.HTTPError) as error:
            raise AuthenticationError("invalid Supabase token") from error

    async def _refresh_keys(self) -> None:
        try:
            response = await self._client.get(self._jwks_url)
            response.raise_for_status()
            payload = response.json()
            keys = payload.get("keys")
            if not isinstance(keys, list):
                raise AuthenticationError("invalid Supabase JWKS")
            refreshed: dict[str, tuple[str, Any]] = {}
            for jwk in keys:
                if not isinstance(jwk, dict):
                    continue
                kid = jwk.get("kid")
                algorithm = jwk.get("alg")
                if not isinstance(kid, str) or algorithm not in {"RS256", "ES256"}:
                    continue
                algorithm_impl = get_default_algorithms()[algorithm]
                refreshed[kid] = (
                    algorithm,
                    algorithm_impl.from_jwk(json.dumps(jwk)),
                )
            if not refreshed:
                raise AuthenticationError("Supabase JWKS has no supported keys")
            self._keys = refreshed
        except AuthenticationError:
            raise
        except (httpx.HTTPError, ValueError, TypeError, KeyError, json.JSONDecodeError) as error:
            raise AuthenticationError("Supabase JWKS unavailable") from error

    async def dispose(self) -> None:
        await self._client.aclose()
