import pytest

from patopay.application.use_cases.policies import PolicyValidationError, parse_minor_limit


@pytest.mark.parametrize("value", ["1.5", "-1", "+1", "1e3", "01", 1.5, True])
def test_policy_limits_reject_non_canonical_minor_values(value: object) -> None:
    with pytest.raises(PolicyValidationError):
        parse_minor_limit(value)


def test_policy_limit_accepts_zero_and_integer_decimal_string() -> None:
    assert parse_minor_limit("0") == 0
    assert parse_minor_limit("145000000") == 145000000


def test_policy_limit_rejects_overflow() -> None:
    with pytest.raises(PolicyValidationError):
        parse_minor_limit("9000000000000001")
