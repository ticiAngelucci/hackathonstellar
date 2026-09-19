from httpx import ASGITransport, AsyncClient

from patopay.main import create_app


class ManagedDatabase:
    disposed = False

    async def check_connection(self) -> None:
        return None

    async def dispose(self) -> None:
        self.disposed = True


async def test_app_disposes_database_on_shutdown() -> None:
    database = ManagedDatabase()
    app = create_app(database=database)

    async with app.router.lifespan_context(app):
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            response = await client.get("/ready")

        assert response.status_code == 200

    assert database.disposed is True
