from httpx import ASGITransport, AsyncClient

from patopay.main import create_app


class ManagedSupabase:
    disposed = False

    async def check_connection(self) -> None:
        return None

    async def dispose(self) -> None:
        self.disposed = True


async def test_app_disposes_supabase_on_shutdown() -> None:
    supabase = ManagedSupabase()
    app = create_app(supabase_gateway=supabase)

    async with app.router.lifespan_context(app):
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            response = await client.get("/ready")

        assert response.status_code == 200

    assert supabase.disposed is True
