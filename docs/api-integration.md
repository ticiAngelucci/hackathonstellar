# PatoPay API: integración inicial con el frontend

## URLs

- API local: `http://127.0.0.1:8000`
- OpenAPI: `http://127.0.0.1:8000/openapi.json`
- Swagger UI: `http://127.0.0.1:8000/docs`
- Supabase: `https://ekgfskibieqljhazchno.supabase.co`
- Proyecto Supabase: `ekgfskibieqljhazchno` (`PatoPay`, región `sa-east-1`)

## Ejecutar la API

Desde `backend/`:

```bash
uv sync --all-groups
cp .env.example .env
uv run uvicorn patopay.main:app --reload
```

La API actual es una primera integración en memoria: reiniciar Uvicorn borra los eventos. La persistencia PostgreSQL y la autenticación JWT son la siguiente slice del plan; todavía no se debe enviar esta API sin autenticación a producción.

## Contrato actual

### Health

```http
GET /health
```

### Crear evento

```http
POST /api/v1/events
Content-Type: application/json
```

Body actual:

```json
{
  "name": "Asado viernes",
  "creator": {
    "user_id": "11111111-1111-4111-8111-111111111111",
    "display_name": "Joaco"
  }
}
```

Respuesta `201`:

```json
{
  "id": "<event-uuid>",
  "name": "Asado viernes",
  "creator_id": "11111111-1111-4111-8111-111111111111",
  "status": "draft",
  "created_at": "<iso-8601>",
  "participants": [
    {
      "user_id": "11111111-1111-4111-8111-111111111111",
      "display_name": "Joaco"
    }
  ]
}
```

### Listar eventos

```http
GET /api/v1/events
```

Devuelve `200` con la lista de eventos creados en el proceso actual.

## Frontend

El frontend debe leer estas variables desde `frontend/.env`:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://ekgfskibieqljhazchno.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
EXPO_PUBLIC_PATOPAY_API_URL=http://127.0.0.1:8000
```

Para un dispositivo físico, `127.0.0.1` debe reemplazarse por la IP LAN de la máquina que ejecuta Uvicorn. El backend ya permite CORS desde `localhost:8081` y `127.0.0.1:8081`.

La integración de magic link/JWT aún no está activada en FastAPI. Cuando se complete esa slice, el body dejará de aceptar `creator`; el backend derivará el usuario del `sub` del JWT.
