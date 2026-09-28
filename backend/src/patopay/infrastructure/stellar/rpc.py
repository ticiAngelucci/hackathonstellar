from __future__ import annotations

from typing import Any

import httpx

from patopay.application.ports.stellar import StellarTransactionResult, StellarTransactionStatus


class StellarRpcAmbiguousError(RuntimeError):
    """The RPC may not have revealed whether a transaction was committed."""


class StellarRpcClient:
    def __init__(
        self,
        rpc_url: str,
        *,
        network: str = "testnet",
        timeout_seconds: float = 10.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        if network != "testnet":
            raise ValueError("only Stellar Testnet reconciliation is enabled")
        self._client = httpx.AsyncClient(
            base_url=rpc_url.rstrip("/"),
            timeout=timeout_seconds,
            transport=transport,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def get_transaction(self, tx_hash: str) -> StellarTransactionResult:
        if len(tx_hash) != 64 or any(char not in "0123456789abcdefABCDEF" for char in tx_hash):
            raise ValueError("transaction hash must be 64 hexadecimal characters")
        try:
            response = await self._client.post(
                "/",
                json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "getTransaction",
                    "params": {"hash": tx_hash},
                },
            )
            response.raise_for_status()
            decoded = response.json()
        except httpx.TimeoutException as error:
            raise StellarRpcAmbiguousError("Stellar RPC transaction lookup timed out") from error
        if not isinstance(decoded, dict) or not isinstance(decoded.get("result"), dict):
            raise ValueError("Stellar RPC response is malformed")
        result = decoded["result"]
        raw_status = result.get("status")
        try:
            status = StellarTransactionStatus(raw_status)
        except ValueError as error:
            raise ValueError("Stellar RPC returned an unknown transaction status") from error
        ledger = result.get("ledger")
        if ledger is not None and (not isinstance(ledger, int) or ledger < 1):
            raise ValueError("Stellar RPC ledger is malformed")
        if status is StellarTransactionStatus.SUCCESS and ledger is None:
            raise ValueError("successful Stellar transaction has no ledger")
        receipt: dict[str, Any] = {"status": status.value, "hash": tx_hash}
        if ledger is not None:
            receipt["ledger"] = ledger
        if isinstance(result.get("events"), list):
            receipt["events"] = result["events"]
        return StellarTransactionResult(status, tx_hash, ledger, receipt)
