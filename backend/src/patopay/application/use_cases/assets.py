from typing import Any, cast


class AssetRegistryError(ValueError):
    pass


class AssetRegistry:
    def __init__(self, gateway: Any, *, contract_id: str | None) -> None:
        self._gateway = gateway
        self._contract_id = contract_id

    async def usdc(self, *, access_token: str) -> dict[str, Any]:
        if not self._contract_id:
            raise AssetRegistryError("USDC Testnet asset is not configured")
        rows = await self._gateway.select(
            "assets",
            access_token=access_token,
            filters={
                "select": "id,network,contract_address,code,decimals,enabled",
                "network": "eq.testnet",
                "contract_address": f"eq.{self._contract_id}",
                "code": "eq.USDC",
                "enabled": "eq.true",
                "limit": "1",
            },
        )
        if not rows:
            raise AssetRegistryError("USDC Testnet asset is not configured")
        return cast(dict[str, Any], rows[0])
