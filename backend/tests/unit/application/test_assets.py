from typing import Any

import pytest

from patopay.application.use_cases.assets import AssetRegistry, AssetRegistryError


class FakeGateway:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows

    async def select(
        self,
        table: str,
        *,
        access_token: str,
        filters: dict[str, str],
    ) -> list[dict[str, Any]]:
        return self.rows


async def test_usdc_registry_requires_configured_enabled_contract() -> None:
    registry = AssetRegistry(
        FakeGateway([]),
        contract_id="CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    )

    with pytest.raises(AssetRegistryError, match="USDC Testnet asset is not configured"):
        await registry.usdc(access_token="user-jwt")


async def test_usdc_registry_returns_exact_configured_asset() -> None:
    row = {
        "id": "asset-1",
        "network": "testnet",
        "contract_address": "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        "code": "USDC",
        "decimals": 7,
        "enabled": True,
    }
    registry = AssetRegistry(FakeGateway([row]), contract_id=row["contract_address"])

    assert await registry.usdc(access_token="user-jwt") == row
