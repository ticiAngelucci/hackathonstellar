from typing import Any
from uuid import UUID

from patopay.domain.money import MAX_AMOUNT_MINOR
from patopay.infrastructure.supabase.gateway import SupabaseTableGateway


class PolicyValidationError(ValueError):
    pass


def parse_minor_limit(value: object) -> int:
    if type(value) is not str or not value.isdigit() or (len(value) > 1 and value.startswith("0")):
        raise PolicyValidationError("policy limits must be canonical decimal strings")
    parsed = int(value)
    if parsed > MAX_AMOUNT_MINOR:
        raise PolicyValidationError("policy limit exceeds supported range")
    return parsed


class PolicyService:
    def __init__(self, gateway: SupabaseTableGateway) -> None:
        self._gateway = gateway

    async def get(self, *, actor_id: UUID, access_token: str) -> dict[str, Any]:
        rows = await self._gateway.select(
            "payment_policy_versions",
            access_token=access_token,
            filters={
                "select": (
                    "id,version,auto_pay_limit_minor,approval_limit_minor,"
                    "daily_limit_minor,recipient_mode,created_at"
                ),
                "user_id": f"eq.{actor_id}",
                "order": "version.desc",
                "limit": "1",
            },
        )
        if not rows:
            raise LookupError("payment policy not found")
        policy = rows[0]
        recipients = await self._gateway.select(
            "policy_allowed_recipients",
            access_token=access_token,
            filters={
                "select": "recipient_profile_id",
                "policy_version_id": f"eq.{policy['id']}",
            },
        )
        assets = await self._gateway.select(
            "policy_allowed_assets",
            access_token=access_token,
            filters={"select": "asset_id", "policy_version_id": f"eq.{policy['id']}"},
        )
        return {
            **policy,
            "allowed_recipient_ids": [row["recipient_profile_id"] for row in recipients],
            "allowed_asset_ids": [row["asset_id"] for row in assets],
        }

    async def replace(
        self,
        *,
        actor_id: UUID,
        access_token: str,
        values: dict[str, Any],
    ) -> dict[str, Any]:
        auto = parse_minor_limit(values["auto_pay_limit_minor"])
        approval = parse_minor_limit(values["approval_limit_minor"])
        daily = parse_minor_limit(values["daily_limit_minor"])
        if auto > approval or daily < 1:
            raise PolicyValidationError("policy thresholds are invalid")
        result = await self._gateway.rpc(
            "replace_payment_policy",
            {
                "p_auto_pay_limit_minor": auto,
                "p_approval_limit_minor": approval,
                "p_daily_limit_minor": daily,
                "p_recipient_mode": values["recipient_mode"],
                "p_allowed_recipient_ids": [str(item) for item in values["allowed_recipient_ids"]],
                "p_allowed_asset_ids": [str(item) for item in values["allowed_asset_ids"]],
                "p_expected_version": values["expected_version"],
            },
            access_token=access_token,
        )
        if not isinstance(result, dict):
            raise ValueError("Supabase policy RPC returned an invalid payload")
        return result
