import pytest

import patopay.domain as domain


@pytest.mark.parametrize("raw", [1.0, True])
def test_amount_minor_rejects_float_and_bool(raw: object) -> None:
    with pytest.raises(ValueError, match="integer base units"):
        domain.AmountMinor(raw)


@pytest.mark.parametrize("raw", [0, -1, 9_000_000_000_000_001])
def test_amount_minor_rejects_zero_negative_and_overflow(raw: int) -> None:
    with pytest.raises(ValueError, match="between 1 and"):
        domain.AmountMinor(raw)
