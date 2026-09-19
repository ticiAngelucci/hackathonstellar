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

La API actual sigue usando memoria para los eventos: reiniciar Uvicorn borra los
registros. La configuración y el pool SQLAlchemy para PostgreSQL ya están
implementados, pero la persistencia de eventos y la autenticación JWT son las
siguientes slices. Todavía no se debe enviar esta API sin autenticación a
producción.

## Contrato actual

### Health

```http
GET /health
```

### Readiness

```http
GET /ready
```

Devuelve `200` con `{"status":"ready"}` únicamente cuando la conexión
PostgreSQL configurada responde. Si falta `PATOPAY_DATABASE_URL` o la base no
está disponible, devuelve `503`.

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

## Probar la API

### Prueba local del backend

Con Uvicorn ejecutándose en una terminal:

```bash
curl --fail http://127.0.0.1:8000/health
curl --fail http://127.0.0.1:8000/ready
```

Crear un evento:

```bash
curl --fail --request POST http://127.0.0.1:8000/api/v1/events \
  --header 'content-type: application/json' \
  --data '{
    "name": "Asado de prueba",
    "creator": {
      "user_id": "11111111-1111-4111-8111-111111111111",
      "display_name": "Joaco"
    }
  }'
```

Listarlo:

```bash
curl --fail http://127.0.0.1:8000/api/v1/events
```

También se puede usar Swagger en `http://127.0.0.1:8000/docs`.

### Prueba desde la máquina de la coordinación

1. En la máquina que ejecuta FastAPI, obtené la IP LAN:

   ```bash
   hostname -I
   ```

2. Levantá el backend escuchando en la red:

   ```bash
   cd backend
   uv run uvicorn patopay.main:app --host 0.0.0.0 --port 8000 --reload
   ```

3. Desde la máquina de la coordinación, reemplazá `API_HOST` por esa IP:

   ```bash
   curl --fail http://API_HOST:8000/health
   curl --fail http://API_HOST:8000/ready
   ```

4. Abrí en su navegador:

   ```text
   http://API_HOST:8000/docs
   ```

5. En `frontend/.env`, debe usar:

   ```dotenv
   EXPO_PUBLIC_PATOPAY_API_URL=http://API_HOST:8000
   ```

Si usa Expo en un dispositivo físico, el teléfono y la computadora deben estar
conectados a la misma red y el firewall debe permitir el puerto `8000`.

> Esta fase todavía usa `InMemoryEventService`: los eventos no se guardan en
> Supabase y se pierden al reiniciar Uvicorn. `/ready` sólo confirma que el
> backend puede conectarse a PostgreSQL; la persistencia real de eventos viene
> en la siguiente slice.

## Frontend

El frontend debe leer estas variables desde `frontend/.env`:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://ekgfskibieqljhazchno.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
EXPO_PUBLIC_PATOPAY_API_URL=http://127.0.0.1:8000
```

Para un dispositivo físico, `127.0.0.1` debe reemplazarse por la IP LAN de la máquina que ejecuta Uvicorn. El backend ya permite CORS desde `localhost:8081` y `127.0.0.1:8081`.

La integración de magic link/JWT aún no está activada en FastAPI. Cuando se complete esa slice, el body dejará de aceptar `creator`; el backend derivará el usuario del `sub` del JWT.
