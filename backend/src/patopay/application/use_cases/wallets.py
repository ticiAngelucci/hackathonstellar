from typing import Any, cast
from uuid import UUID

from patopay.api.schemas.wallets import WalletCreate
from patopay.infrastructure.supabase.gateway import SupabaseTableGateway


class WalletService:
    def __init__(self, gateway: SupabaseTableGateway) -> None:
        self._gateway = gateway

    async def create(
        self,
        *,
        actor_id: UUID,
        access_token: str,
        payload: WalletCreate,
    ) -> dict[str, Any]:
        record = {
            "user_id": str(actor_id),
            "provider": payload.provider,
            "network": payload.network,
            "contract_address": payload.contract_address,
            "wallet_wasm_hash": payload.wallet_wasm_hash,
            "creation_tx_hash": payload.creation_tx_hash,
            "status": "unverified",
            "is_default": payload.is_default,
            "version": 1,
        }
        rows = await self._gateway.insert(
            "wallets",
            record,
            access_token=access_token,
            params={
                "select": (
                    "id,provider,network,contract_address,wallet_wasm_hash,"
                    "creation_tx_hash,status,is_default,version"
                )
            },
        )
        if not isinstance(rows, list) or not rows:
            raise ValueError("Supabase did not return the created wallet")
        return cast(dict[str, Any], rows[0])

    async def list(self, *, actor_id: UUID, access_token: str) -> list[dict[str, Any]]:
        return await self._gateway.select(
            "wallets",
            access_token=access_token,
            filters={
                "select": (
                    "id,provider,network,contract_address,wallet_wasm_hash,"
                    "creation_tx_hash,status,is_default,version"
                ),
                "user_id": f"eq.{actor_id}",
                "order": "created_at.asc,id.asc",
            },
        )

    async def get(
        self,
        *,
        actor_id: UUID,
        wallet_id: UUID,
        access_token: str,
    ) -> dict[str, Any]:
        rows = await self._gateway.select(
            "wallets",
            access_token=access_token,
            filters={
                "select": (
                    "id,provider,network,contract_address,wallet_wasm_hash,"
                    "creation_tx_hash,status,is_default,version"
                ),
                "id": f"eq.{wallet_id}",
                "user_id": f"eq.{actor_id}",
                "limit": "1",
            },
        )
        if not rows:
            raise LookupError("wallet not found")
        return rows[0]

    async def disable(
        self,
        *,
        actor_id: UUID,
        wallet_id: UUID,
        access_token: str,
        expected_version: int,
    ) -> None:
        rows = await self._gateway.update(
            "wallets",
            {"status": "disabled", "version": expected_version + 1},
            access_token=access_token,
            filters={
                "id": f"eq.{wallet_id}",
                "user_id": f"eq.{actor_id}",
                "version": f"eq.{expected_version}",
            },
        )
        if not isinstance(rows, list) or not rows:
            raise LookupError("wallet not found or version is stale")

    async def mock_balance(
        self,
        *,
        actor_id: UUID,
        wallet_id: UUID,
        access_token: str,
    ) -> dict[str, Any]:
        wallet = await self.get(
            actor_id=actor_id,
            wallet_id=wallet_id,
            access_token=access_token,
        )
        if wallet["provider"] != "mock":
            raise RuntimeError("Stellar balance adapter is not configured")
        rows = await self._gateway.select(
            "mock_wallet_balances",
            access_token=access_token,
            filters={
                "select": "wallet_id,balance_minor,observed_at",
                "wallet_id": f"eq.{wallet_id}",
                "limit": "1",
            },
        )
        if not rows:
            return {
                "wallet_id": str(wallet_id),
                "asset_id": None,
                "amount_minor": "0",
                "observed_at": "",
                "ledger": None,
                "mode": "mock",
            }
        row = rows[0]
        return {
            "wallet_id": str(wallet_id),
            "asset_id": None,
            "amount_minor": str(row.get("balance_minor", 0)),
            "observed_at": str(row.get("observed_at", "")),
            "ledger": None,
            "mode": "mock",
        }
