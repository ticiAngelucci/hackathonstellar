from typing import Literal

from pydantic import Field, model_validator

from patopay.api.schemas import ApiModel


class WalletCreate(ApiModel):
    provider: Literal["mock", "stellar"]
    network: Literal["mock", "testnet"]
    contract_address: str = Field(min_length=1, max_length=128)
    wallet_wasm_hash: str | None = Field(default=None, max_length=128)
    creation_tx_hash: str | None = Field(default=None, max_length=128)
    status: Literal["unverified"] = "unverified"
    is_default: bool = False
    expected_version: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def validate_network(self) -> "WalletCreate":
        if self.provider == "stellar" and self.network != "testnet":
            raise ValueError("Stellar wallets must use Testnet")
        return self


class WalletResponse(ApiModel):
    id: str
    provider: str
    network: str
    contract_address: str
    wallet_wasm_hash: str | None
    creation_tx_hash: str | None
    status: str
    is_default: bool
    version: int


class WalletBalanceResponse(ApiModel):
    wallet_id: str
    asset_id: str | None
    amount_minor: str
    observed_at: str
    ledger: int | None = None
    mode: Literal["mock", "stellar"]
