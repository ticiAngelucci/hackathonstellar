# Integración con PatoPay API

La guía canónica para implementar el frontend está en:

```text
frontend/BACKEND_INTEGRATION.md
```

La referencia visual de endpoints, al estilo Swagger, está en:

```text
docs/patopay-api-reference.html
```

Incluye:

- configuración local para Expo, emuladores y teléfono físico;
- autenticación con el JWT de Supabase;
- cliente HTTP sugerido para FastAPI;
- tipos TypeScript;
- contrato y ejemplos de los 20 endpoints actuales;
- manejo de dinero en unidades base enteras;
- idempotencia y versionado optimista;
- estados de error y límites de la implementación actual;
- orden recomendado de integración y flujo mínimo de demo.

El contrato ejecutable se genera desde FastAPI:

```text
http://127.0.0.1:8000/docs
http://127.0.0.1:8000/openapi.json
```

No usar la API REST de las tablas legacy de `public` para implementar los flujos
nuevos. El frontend autentica con Supabase Auth y envía el `access_token` a FastAPI;
FastAPI accede a Supabase Cloud mediante PostgREST/RPC y RLS.
