from typing import Any, Protocol


class PaymentExecutor(Protocol):
    async def execute(self, attempt: Any) -> object: ...
