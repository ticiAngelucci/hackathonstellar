from dataclasses import dataclass
from enum import StrEnum
from typing import Any, Protocol


class StellarTransactionStatus(StrEnum):
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    PENDING = "PENDING"
    NOT_FOUND = "NOT_FOUND"


@dataclass(frozen=True, slots=True)
class StellarTransactionResult:
    status: StellarTransactionStatus
    tx_hash: str
    ledger: int | None
    receipt: dict[str, Any]


class StellarTransactionReader(Protocol):
    async def get_transaction(self, tx_hash: str) -> StellarTransactionResult: ...
