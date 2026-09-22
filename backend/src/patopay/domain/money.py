from dataclasses import dataclass

MAX_AMOUNT_MINOR = 9_000_000_000_000_000


@dataclass(frozen=True, slots=True)
class AmountMinor:
    value: int

    def __post_init__(self) -> None:
        if type(self.value) is not int:
            raise ValueError("amount must use integer base units")
        if not 1 <= self.value <= MAX_AMOUNT_MINOR:
            raise ValueError(f"amount must be between 1 and {MAX_AMOUNT_MINOR}")
