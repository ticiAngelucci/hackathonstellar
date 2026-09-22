from typing import Protocol

from patopay.infrastructure.postgres.models import PaymentAttemptModel


class PaymentExecutor(Protocol):
    async def execute(self, attempt: PaymentAttemptModel) -> object: ...
