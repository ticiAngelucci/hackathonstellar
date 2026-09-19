# Guía de integración Frontend ↔ PatoPay API

Runbook para levantar y probar el frontend junto con el backend local.

## Arquitectura local

```text
Expo / React Native
        │
        │ HTTP + CORS
        ▼
FastAPI local (:8000)
        │
        │ PostgreSQL / readiness
        ▼
Supabase Cloud Free
https://ekgfskibieqljhazchno.supabase.co
```

Supabase no se levanta en el VPS ni con Docker para este flujo. El proyecto
compartido está en Supabase Cloud Free. En esta fase el backend todavía guarda
los eventos en memoria; la conexión PostgreSQL se verifica con `/ready`, pero
los eventos aún no se persisten en Supabase.

## Requisitos

- Node.js y npm.
- Python 3.11.
- `uv`.
- Acceso al proyecto Supabase PatoPay.
- Frontend y backend en la misma red si se prueba desde un teléfono físico.

## 1. Configurar el backend

Desde la raíz del repositorio:

```bash
cd backend
uv sync --all-groups
cp .env.example .env
```

Editar `backend/.env` y completar los valores privados:

```dotenv
PATOPAY_ENV=local
PATOPAY_SUPABASE_URL=https://ekgfskibieqljhazchno.supabase.co
PATOPAY_SUPABASE_PROJECT_REF=ekgfskibieqljhazchno
PATOPAY_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
PATOPAY_DATABASE_URL=postgresql+psycopg://<user>:<password>@<session-pooler-host>:5432/postgres
PATOPAY_CORS_ORIGINS=["http://localhost:8081","http://127.0.0.1:8081"]
```

### De dónde sale `PATOPAY_DATABASE_URL`

En Supabase:

```text
Connect
→ Direct / Connection string
→ Session pooler
→ URI
```

Para este desarrollo local usamos **Session pooler** porque la conexión
Direct depende de IPv6. Copiar la URI que muestra Supabase y cambiar solamente
el esquema:

```text
postgresql://...
```

a:

```text
postgresql+psycopg://...
```

La contraseña es la **Database Password** del proyecto, no la publishable key
ni el token de Supabase CLI. Si contiene caracteres especiales, debe estar
URL-encoded.

Nunca subir `backend/.env` a Git ni compartir su contenido por chat.

## 2. Verificar la conexión del backend

Sin mostrar la contraseña, comprobar que el archivo existe:

```bash
cd backend
python - <<'PY'
from pathlib import Path

path = Path('.env')
required = {
    'PATOPAY_SUPABASE_URL',
    'PATOPAY_SUPABASE_PROJECT_REF',
    'PATOPAY_SUPABASE_PUBLISHABLE_KEY',
    'PATOPAY_DATABASE_URL',
}
keys = {
    line.split('=', 1)[0].strip()
    for line in path.read_text().splitlines()
    if line.strip() and not line.lstrip().startswith('#') and '=' in line
}
missing = required - keys
print('missing:', ', '.join(sorted(missing)) if missing else 'none')
PY
```

Debe imprimir:

```text
missing: none
```

## 3. Levantar FastAPI

### En la misma computadora que el frontend

```bash
cd backend
uv run uvicorn patopay.main:app --reload --port 8000
```

### Para probar desde otra computadora o teléfono

Obtener la IP LAN de la computadora que ejecuta FastAPI:

```bash
hostname -I
```

Levantar escuchando en la red:

```bash
cd backend
uv run uvicorn patopay.main:app --host 0.0.0.0 --port 8000 --reload
```

Ejemplo de IP:

```text
192.168.1.25
```

El teléfono/computadora de la coordinación debe estar en la misma red y el
firewall debe permitir el puerto `8000`.

## 4. Probar el backend

Reemplazar `API_HOST` por `127.0.0.1` si se prueba en la misma máquina o por la
IP LAN si se prueba desde otro dispositivo.

### Health del proceso

```bash
curl --fail http://API_HOST:8000/health
```

Respuesta esperada:

```json
{"status":"ok","service":"patopay-api","version":"0.1.0"}
```

### Readiness de PostgreSQL

```bash
curl --fail --include http://API_HOST:8000/ready
```

Respuesta esperada si la URI de Supabase funciona:

```http
HTTP/1.1 200 OK
```

```json
{"status":"ready"}
```

Un `503` significa que falta `PATOPAY_DATABASE_URL`, la URI es inválida o
Supabase rechazó la conexión.

### Swagger

Abrir:

```text
http://API_HOST:8000/docs
```

### Crear un evento

```bash
curl --fail --request POST http://API_HOST:8000/api/v1/events \
  --header 'content-type: application/json' \
  --data '{
    "name": "Asado de prueba",
    "creator": {
      "user_id": "11111111-1111-4111-8111-111111111111",
      "display_name": "Joaco"
    }
  }'
```

Respuesta esperada: `201 Created` con un evento en estado `draft`.

### Listar eventos

```bash
curl --fail http://API_HOST:8000/api/v1/events
```

Respuesta esperada: `200 OK` con una lista JSON.

## 5. Configurar el frontend

Desde otra terminal:

```bash
cd frontend
npm ci
cp .env.example .env
```

Editar `frontend/.env`:

### Frontend y backend en la misma máquina

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://ekgfskibieqljhazchno.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
EXPO_PUBLIC_PATOPAY_API_URL=http://127.0.0.1:8000
```

### Frontend en teléfono o en otra computadora

Usar la IP LAN del equipo donde corre FastAPI:

```dotenv
EXPO_PUBLIC_PATOPAY_API_URL=http://192.168.1.25:8000
```

La URL no debe terminar en `/` porque los servicios HTTP agregarán las rutas.

Levantar Expo:

```bash
cd frontend
npx expo start
```

## 6. Checklist para la coordinación

- [ ] Puede abrir `http://API_HOST:8000/docs`.
- [ ] `GET /health` responde `200`.
- [ ] `GET /ready` responde `200`.
- [ ] `POST /api/v1/events` responde `201`.
- [ ] `GET /api/v1/events` devuelve el evento creado.
- [ ] El frontend usa `EXPO_PUBLIC_PATOPAY_API_URL` con la IP correcta.
- [ ] El teléfono y la computadora están en la misma red.
- [ ] `backend/.env` y `frontend/.env` no aparecen en Git.

## Limitaciones actuales

Esta integración todavía no incluye:

- Supabase Auth/JWT en FastAPI.
- Persistencia de eventos en PostgreSQL.
- Participantes persistentes.
- Gastos y balances.
- x402, Stellar o pagos reales.

Actualmente `POST /api/v1/events` todavía recibe `creator` en el body y los
eventos viven en `InMemoryEventService`; al reiniciar FastAPI se pierden.
