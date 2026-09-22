import pytest

from patopay.api.schemas.wallets import WalletCreate


@pytest.mark.parametrize("field", ["private_key", "seed_phrase", "signed_xdr"])
def test_wallet_schema_rejects_private_material(field: str) -> None:
    payload = {
        "provider": "stellar",
        "network": "testnet",
        "contract_address": "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        field: "secret",
    }

    with pytest.raises(ValueError):
        WalletCreate.model_validate(payload)


def test_wallet_schema_accepts_public_metadata_only() -> None:
    wallet = WalletCreate(
        provider="stellar",
        network="testnet",
        contract_address="CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    )

    assert wallet.status == "unverified"
    assert wallet.is_default is False
