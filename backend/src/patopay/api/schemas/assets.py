from typing import Literal
from uuid import UUID

from patopay.api.schemas import ApiModel


class AssetResponse(ApiModel):
    id: UUID
    network: Literal["testnet"]
    contract_address: str
    code: str
    decimals: int
    enabled: bool
