from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True, slots=True)
class MockPaymentExecutor:
    mode: str = "mock"

    async def execute(self, _attempt: Any) -> dict[str, str]:
        return {"mode": self.mode, "status": "simulated"}
