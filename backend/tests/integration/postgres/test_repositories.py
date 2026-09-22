import os
from uuid import UUID, uuid4

import pytest

from patopay.infrastructure.postgres.models import AssetModel

pytestmark = pytest.mark.integration


async def test_asset_repository_round_trip(unit_of_work: object) -> None:
    asset_id = uuid4()
    asset = AssetModel(
        id=asset_id,
        network="testnet",
        contract_address="C" + ("A" * 55),
        code="USDC",
        decimals=7,
        enabled=True,
    )

    async with unit_of_work as work:  # type: ignore[attr-defined]
        await work.assets.add(asset)
        await work.session.flush()
        loaded = await work.assets.get(asset_id)
        assert loaded is not None
        assert loaded.code == "USDC"
        await work.rollback()


async def test_payment_request_update_uses_optimistic_version(unit_of_work: object) -> None:
    request_id = os.getenv("PATOPAY_TEST_PAYMENT_REQUEST_ID")
    if not request_id:
        pytest.skip("PATOPAY_TEST_PAYMENT_REQUEST_ID is required for optimistic update test")

    async with unit_of_work as work:  # type: ignore[attr-defined]
        updated = await work.payment_requests.update_status(  # type: ignore[attr-defined]
            UUID(request_id),
            int(os.getenv("PATOPAY_TEST_PAYMENT_REQUEST_VERSION", "1")),
            "approved",
        )
        assert updated is True
        await work.rollback()
