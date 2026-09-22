from fastapi import HTTPException, Request, status

from patopay.infrastructure.supabase.client import SupabaseClient
from patopay.infrastructure.supabase.gateway import SupabaseTableGateway


def get_supabase_table_gateway(request: Request) -> SupabaseTableGateway:
    client = getattr(request.app.state, "supabase", None)
    if not isinstance(client, SupabaseClient):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase is not configured",
        )
    return SupabaseTableGateway(client)
