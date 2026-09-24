# Integración del frontend con PatoPay API

Guía práctica para integrar el frontend Expo/React Native con la API FastAPI actual.
Está escrita sobre el contrato implementado, no sobre el roadmap.

## 1. Qué servicio debe usar el frontend

El frontend usa dos servicios distintos:

```text
Expo / React Native
  ├─ Supabase Auth: iniciar sesión y renovar la sesión
  └─ PatoPay API: perfiles, eventos, wallets, políticas y solicitudes de pago
                         │
                         └─ FastAPI usa Supabase PostgREST/RPC por HTTP
```

Para las operaciones de dominio nuevas, el frontend debe llamar a FastAPI. No debe
escribir directamente en las tablas del schema `patopay`.

En particular, hay que reemplazar gradualmente el acceso directo a las tablas legacy
que hoy aparece en:

- `src/services/eventService.ts`
- `src/services/appDataService.ts`
- `src/services/supabaseClient.ts`

Supabase Auth sí sigue siendo responsabilidad del frontend. Su `access_token` se manda
a FastAPI como Bearer token.

## 2. Estado actual y límites

### Implementado

- autenticación mediante JWT de Supabase;
- perfil propio y búsqueda de perfiles por username;
- creación y listado de eventos persistentes;
- registro, consulta y desactivación de wallets públicas;
- políticas de pago versionadas;
- suscripciones a servicios;
- creación idempotente y consulta de solicitudes de pago;
- RLS y actor derivado exclusivamente del `sub` del JWT.

### Todavía no implementado

- detalle individual de un evento;
- agregar o eliminar participantes de un evento;
- carga de gastos y cálculo final del evento;
- endpoint público para listar assets habilitados;
- aprobación o rechazo manual de una solicitud;
- firma local, smart wallet, relayer y ejecución real en Stellar;
- reconciliación, `txHash` y estado `paid`;
- balance real de una wallet Stellar.

No completar estos huecos desde el frontend con datos falsos. En particular:

- `approved` significa que la policy habilitó el pago; no significa `paid`;
- una wallet Stellar devuelve `503` al consultar el balance hasta que exista el adapter real;
- no mostrar balances, transacciones, hashes o enlaces al explorer inventados.

## 3. URLs y configuración

### Backend local

```text
API:          http://127.0.0.1:8000
Swagger:      http://127.0.0.1:8000/docs
OpenAPI JSON: http://127.0.0.1:8000/openapi.json
```

Variable del frontend:

```dotenv
EXPO_PUBLIC_PATOPAY_API_URL=http://127.0.0.1:8000
```

La URL no debe terminar en `/`.

### Según dónde corre Expo

| Entorno | URL habitual |
|---|---|
| Web o iOS Simulator en la misma máquina | `http://127.0.0.1:8000` |
| Android Emulator | `http://10.0.2.2:8000` |
| Teléfono físico | `http://<IP-LAN-DE-LA-PC>:8000` |

Para un teléfono físico, levantar FastAPI escuchando en la red:

```bash
cd backend
uv run uvicorn patopay.main:app --host 0.0.0.0 --port 8000 --reload
```

El teléfono y la computadora deben estar en la misma red.

## 4. Autenticación

Todos los endpoints `/api/v1/*` requieren el JWT de la sesión de Supabase:

```http
Authorization: Bearer <supabase-access-token>
```

El frontend nunca debe enviar `user_id`, `creator_id` o `requester_id` para elegir la
identidad activa. FastAPI obtiene al usuario exclusivamente del claim `sub` del JWT.

No mandar la publishable key de Supabase a FastAPI. Tampoco mandar claves privadas,
seed phrases, secretos WebAuthn, `service_role` o XDR firmado reutilizable.

### Helper sugerido para obtener el token

El proyecto ya crea el cliente en `src/services/supabaseAuth.ts`. Agregar allí una
función con este comportamiento:

```ts
export async function getApiAccessToken(): Promise<string> {
  const supabase = getClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) throw error;
  if (!session) throw new Error('Necesitás iniciar sesión para continuar.');

  return session.access_token;
}
```

No hace falta decodificar el JWT en el frontend para obtener el ID del usuario.

## 5. Cliente HTTP recomendado

Crear un cliente separado, por ejemplo:

```text
src/services/api/patopayApi.ts
```

Implementación base sugerida:

```ts
import { getApiAccessToken } from '@/services/supabaseAuth';

const REQUEST_TIMEOUT_MS = 10_000;

export class PatoPayApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'PatoPayApiError';
  }
}

function getApiUrl(): string {
  const value = process.env.EXPO_PUBLIC_PATOPAY_API_URL?.trim().replace(/\/+$/, '');
  if (!value) throw new Error('Falta EXPO_PUBLIC_PATOPAY_API_URL en frontend/.env.');
  return value;
}

async function readError(response: Response): Promise<unknown> {
  return response.json().catch(() => undefined);
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getApiAccessToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${getApiUrl()}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await readError(response);
      const detail =
        body && typeof body === 'object' && 'detail' in body
          ? (body as { detail: unknown }).detail
          : body;
      const message =
        typeof detail === 'string' ? detail : `PatoPay API respondió ${response.status}.`;
      throw new PatoPayApiError(message, response.status, detail);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof PatoPayApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new PatoPayApiError('PatoPay API tardó demasiado en responder.', 408);
    }
    throw new PatoPayApiError('No pudimos conectar con PatoPay API.', 0, error);
  } finally {
    clearTimeout(timeout);
  }
}
```

### Tratamiento recomendado por status

| Status | Significado | Acción del frontend |
|---|---|---|
| `401` | sesión ausente, vencida o inválida | renovar sesión o volver al login |
| `404` | recurso inexistente o no visible para el usuario | mostrar estado vacío/no encontrado |
| `409` | conflicto de versión, binding o idempotencia | refrescar el recurso antes de reintentar |
| `422` | payload inválido | mostrar validación; no reintentar automáticamente |
| `502` | Supabase falló detrás de FastAPI | mostrar error temporal y permitir reintento |
| `503` | integración requerida todavía no disponible | mostrar “función no disponible” |

FastAPI devuelve errores simples así:

```json
{
  "detail": "Authentication required"
}
```

Los errores de validación `422` pueden traer un array dentro de `detail`.

## 6. Dinero: regla obligatoria

USDC usa siete decimales en esta integración. Todos los montos autoritativos viajan
como strings enteros en unidades base:

```text
1 USDC     = "10000000"
12 USDC    = "120000000"
14.5 USDC  = "145000000"
```

No usar `number`, `parseFloat` ni aritmética de punto flotante para guardar, sumar o
enviar dinero. Usar strings y `BigInt`.

### Formatear unidades base para UI

```ts
export function formatMinorUnits(value: string, scale = 7): string {
  const units = BigInt(value);
  const base = 10n ** BigInt(scale);
  const whole = units / base;
  const fraction = (units % base).toString().padStart(scale, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}
```

### Convertir texto decimal ingresado por el usuario

```ts
export function decimalToMinorUnits(value: string, scale = 7): string {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) throw new Error('Monto inválido.');

  const [whole, fraction = ''] = normalized.split('.');
  if (fraction.length > scale) throw new Error(`Máximo ${scale} decimales.`);

  const base = 10n ** BigInt(scale);
  return (BigInt(whole) * base + BigInt(fraction.padEnd(scale, '0') || '0')).toString();
}
```

El backend sólo acepta strings decimales canónicos: sin signo, sin espacios, sin
ceros a la izquierda y con valor mayor a cero cuando se crea una solicitud de pago.

## 7. Tipos TypeScript sugeridos

```ts
export type UUID = string;

export type Profile = {
  id: UUID;
  username: string | null;
  display_name: string | null;
  notifications_enabled: boolean;
};

export type PublicProfile = Pick<Profile, 'id' | 'username' | 'display_name'>;

export type EventParticipant = {
  user_id: UUID;
  display_name: string;
};

export type PatoPayEvent = {
  id: UUID;
  name: string;
  creator_id: UUID;
  status: 'draft';
  created_at: string;
  participants: EventParticipant[];
};

export type Wallet = {
  id: UUID;
  provider: 'mock' | 'stellar';
  network: 'mock' | 'testnet';
  contract_address: string;
  wallet_wasm_hash: string | null;
  creation_tx_hash: string | null;
  status: 'unverified' | 'active' | 'disabled';
  is_default: boolean;
  version: number;
};

export type WalletBalance = {
  wallet_id: UUID;
  asset_id: UUID | null;
  amount_minor: string;
  observed_at: string;
  ledger: number | null;
  mode: 'mock' | 'stellar';
};

export type PaymentPolicy = {
  id: UUID;
  version: number;
  auto_pay_limit_minor: string;
  approval_limit_minor: string;
  daily_limit_minor: string;
  recipient_mode: 'any' | 'allowlist';
  allowed_recipient_ids: UUID[];
  allowed_asset_ids: UUID[];
};

export type ServiceSubscription = {
  service_id: 'electricity' | 'internet' | 'water';
  enabled: boolean;
  updated_at: string;
};

export type PaymentRequestStatus =
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'cancelled'
  | 'blocked';

export type PaymentRequestSummary = {
  id: UUID;
  requester_id: UUID;
  payer_id: UUID;
  asset_id: UUID;
  amount_minor: string;
  memo: string | null;
  status: PaymentRequestStatus;
};

export type PaymentRequestCreated = {
  id: UUID;
  status: PaymentRequestStatus;
  policy_outcome: 'eligible_for_auto_approval' | 'approval_required' | 'blocked';
  reason_code: string;
  next_action: 'prepare_sign_and_execute' | 'approve_or_reject' | null;
  amount_minor: string;
  asset_id: UUID;
};
```

## 8. Inventario rápido de endpoints

Excepto health y readiness, todos requieren `Authorization: Bearer <JWT>`.

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/health` | proceso FastAPI activo |
| `GET` | `/ready` | FastAPI puede alcanzar Supabase |
| `GET` | `/api/v1/me` | obtener perfil propio |
| `PUT` | `/api/v1/me` | crear o reemplazar perfil propio |
| `PATCH` | `/api/v1/me` | actualizar campos del perfil |
| `GET` | `/api/v1/profiles?username=...` | buscar usuario exacto |
| `POST` | `/api/v1/events` | crear evento |
| `GET` | `/api/v1/events` | listar eventos visibles |
| `POST` | `/api/v1/me/wallets` | registrar metadata pública de wallet |
| `GET` | `/api/v1/me/wallets` | listar wallets propias |
| `GET` | `/api/v1/me/wallets/{wallet_id}` | obtener wallet propia |
| `DELETE` | `/api/v1/me/wallets/{wallet_id}?expected_version=N` | desactivar wallet |
| `GET` | `/api/v1/me/wallets/{wallet_id}/balance` | consultar balance disponible |
| `GET` | `/api/v1/me/payment-policy` | obtener policy vigente |
| `PUT` | `/api/v1/me/payment-policy` | crear una nueva versión de policy |
| `GET` | `/api/v1/me/service-subscriptions` | listar servicios habilitados |
| `PUT` | `/api/v1/me/service-subscriptions/{service_id}` | habilitar/deshabilitar servicio |
| `POST` | `/api/v1/payment-requests` | crear/evaluar una solicitud |
| `GET` | `/api/v1/payment-requests` | listar solicitudes visibles |
| `GET` | `/api/v1/payment-requests/{request_id}` | obtener una solicitud |

## 9. Perfiles

### Obtener el perfil actual

```http
GET /api/v1/me
Authorization: Bearer <JWT>
```

Respuesta `200`:

```json
{
  "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "username": "tici",
  "display_name": "Tici",
  "notifications_enabled": true
}
```

El `id` debe coincidir con el `sub` del JWT. Nunca se manda desde el frontend.

### Crear o reemplazar el perfil

Usar este endpoint después del primer login para asegurar que exista un perfil:

```http
PUT /api/v1/me
Authorization: Bearer <JWT>
Content-Type: application/json
```

```json
{
  "username": "tici",
  "display_name": "Tici",
  "notifications_enabled": true
}
```

Reglas de `username`:

- entre 3 y 40 caracteres;
- sólo minúsculas, números y `_`;
- debe ser único.

Conflicto de username: `409`.

### Actualizar parcialmente

```http
PATCH /api/v1/me
Authorization: Bearer <JWT>
Content-Type: application/json
```

```json
{
  "display_name": "Tici Pato",
  "notifications_enabled": false
}
```

No mandar `id`, `user_id` ni campos adicionales: el backend usa `extra="forbid"` y
responderá `422`.

### Buscar otro usuario

```http
GET /api/v1/profiles?username=joaco
Authorization: Bearer <JWT>
```

La búsqueda es exacta y devuelve datos públicos mínimos:

```json
{
  "id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "username": "joaco",
  "display_name": "Joaco"
}
```

Este `id` puede usarse como `payer_profile_id` o en una allowlist.

## 10. Eventos

### Crear evento

```http
POST /api/v1/events
Authorization: Bearer <JWT>
Content-Type: application/json
```

```json
{
  "name": "Asado del viernes"
}
```

Respuesta `201`:

```json
{
  "id": "22222222-2222-4222-8222-222222222222",
  "name": "Asado del viernes",
  "creator_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "status": "draft",
  "created_at": "2026-09-22T12:00:00Z",
  "participants": [
    {
      "user_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "display_name": "Tici"
    }
  ]
}
```

El creador se deriva del JWT y se agrega automáticamente como participante owner.
No mandar `creator`, `creator_id`, `status` ni `participants`.

### Listar eventos

```http
GET /api/v1/events
Authorization: Bearer <JWT>
```

Respuesta `200`: `PatoPayEvent[]`.

Actualmente no existe `GET /events/{id}`. Para abrir un evento, reutilizar el objeto
del listado o buscarlo en el estado/cache local.

## 11. Wallets

Sólo se registra metadata pública. Nunca enviar claves privadas, seed phrases o
secretos de passkey.

### Registrar wallet Stellar Testnet

```http
POST /api/v1/me/wallets
Authorization: Bearer <JWT>
Content-Type: application/json
```

```json
{
  "provider": "stellar",
  "network": "testnet",
  "contract_address": "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  "wallet_wasm_hash": null,
  "creation_tx_hash": null,
  "status": "unverified",
  "is_default": true
}
```

Respuesta `201`: `Wallet` con `version: 1`.

Combinaciones válidas:

- `provider: "stellar"` requiere `network: "testnet"`;
- `provider: "mock"` usa `network: "mock"`.

### Listar wallets

```http
GET /api/v1/me/wallets
Authorization: Bearer <JWT>
```

Respuesta `200`: `Wallet[]`.

### Obtener una wallet

```http
GET /api/v1/me/wallets/{wallet_id}
Authorization: Bearer <JWT>
```

### Desactivar una wallet

```http
DELETE /api/v1/me/wallets/{wallet_id}?expected_version=1
Authorization: Bearer <JWT>
```

Respuesta correcta: `204 No Content`.

Mandar como `expected_version` la versión que el frontend leyó. Si quedó vieja o la
wallet no existe, la API devuelve `404` y hay que refrescar el listado.

### Consultar balance

```http
GET /api/v1/me/wallets/{wallet_id}/balance
Authorization: Bearer <JWT>
```

Para provider `mock` puede devolver:

```json
{
  "wallet_id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "asset_id": null,
  "amount_minor": "100000000",
  "observed_at": "2026-09-22T12:00:00Z",
  "ledger": null,
  "mode": "mock"
}
```

Para provider `stellar`, el estado actual correcto es:

```http
503 Service Unavailable
```

```json
{
  "detail": "Stellar balance adapter is not configured"
}
```

La UI debe mostrar “Balance Stellar todavía no disponible”, no `0 USDC`.

## 12. Política de pagos

### Obtener policy vigente

```http
GET /api/v1/me/payment-policy
Authorization: Bearer <JWT>
```

Respuesta `200`:

```json
{
  "id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  "version": 1,
  "auto_pay_limit_minor": "200000000",
  "approval_limit_minor": "500000000",
  "daily_limit_minor": "1000000000",
  "recipient_mode": "any",
  "allowed_recipient_ids": [],
  "allowed_asset_ids": ["dddddddd-dddd-4ddd-8ddd-dddddddddddd"]
}
```

Si el usuario todavía no creó una policy, devuelve `404`. La UI debe llevarlo a la
configuración inicial, no asumir límites por defecto en silencio.

### Crear o reemplazar policy

Cada `PUT` crea una nueva versión de la policy:

```http
PUT /api/v1/me/payment-policy
Authorization: Bearer <JWT>
Content-Type: application/json
```

```json
{
  "auto_pay_limit_minor": "200000000",
  "approval_limit_minor": "500000000",
  "daily_limit_minor": "1000000000",
  "recipient_mode": "allowlist",
  "allowed_recipient_ids": ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
  "allowed_asset_ids": ["dddddddd-dddd-4ddd-8ddd-dddddddddddd"],
  "expected_version": 1
}
```

Reglas:

- todos los límites son strings enteros en unidades base;
- `auto_pay_limit_minor <= approval_limit_minor`;
- `daily_limit_minor >= 1`;
- `allowed_asset_ids` debe tener al menos un asset;
- con `recipient_mode: "allowlist"`, mandar los perfiles habilitados;
- `expected_version: 0` crea la primera policy;
- para actualizaciones, mandar la versión vigente obtenida con `GET`.

Una versión desactualizada devuelve `409`. Refrescar antes de volver a guardar.

> Bloqueo actual: la API todavía no expone `GET /assets`. El frontend necesita recibir
> temporalmente el UUID del asset USDC por configuración o esperar ese endpoint. No
> usar el contract ID de Stellar donde la API espera `asset_id`: son identificadores
> diferentes.

## 13. Suscripciones a servicios

IDs permitidos:

```text
electricity
internet
water
```

### Listar

```http
GET /api/v1/me/service-subscriptions
Authorization: Bearer <JWT>
```

Respuesta `200`:

```json
[
  {
    "service_id": "internet",
    "enabled": true,
    "updated_at": "2026-09-22T12:00:00Z"
  }
]
```

### Habilitar o deshabilitar

```http
PUT /api/v1/me/service-subscriptions/internet
Authorization: Bearer <JWT>
Content-Type: application/json
```

```json
{
  "enabled": true
}
```

Respuesta `200`: el objeto guardado. Un `service_id` desconocido devuelve `422`.

## 14. Solicitudes de pago

### Crear una solicitud

```http
POST /api/v1/payment-requests
Authorization: Bearer <JWT>
Idempotency-Key: 7fd5bb7d-9829-4aeb-a433-57b29472f123
Content-Type: application/json
```

```json
{
  "payer_profile_id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "amount_minor": "145000000",
  "asset_id": "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  "memo": "Asado del viernes"
}
```

Reglas:

- `payer_profile_id` se obtiene con la búsqueda de perfiles;
- el requester se deriva del JWT y no aparece en el body;
- `amount_minor` es un string entero canónico entre `1` y `9000000000000000`;
- `memo` es opcional, máximo 500 caracteres;
- `Idempotency-Key` es obligatorio y admite entre 1 y 128 caracteres.

Generar una clave una sola vez por acción lógica del usuario y conservarla durante
los reintentos. No generar una clave nueva por cada retry de red. No reutilizar la
misma clave para otro payload.

Respuesta `201` cuando requiere aprobación:

```json
{
  "id": "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  "status": "pending_approval",
  "policy_outcome": "approval_required",
  "reason_code": "manual_approval_required",
  "next_action": "approve_or_reject",
  "amount_minor": "145000000",
  "asset_id": "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
}
```

Respuesta posible cuando la policy permite automatización:

```json
{
  "id": "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  "status": "approved",
  "policy_outcome": "eligible_for_auto_approval",
  "reason_code": "within_auto_pay_limit",
  "next_action": "prepare_sign_and_execute",
  "amount_minor": "100000000",
  "asset_id": "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
}
```

Ese `approved` todavía no representa una transferencia ejecutada.

### Listar solicitudes

```http
GET /api/v1/payment-requests
Authorization: Bearer <JWT>
```

Filtro opcional:

```http
GET /api/v1/payment-requests?status_filter=pending_approval
```

Estados persistidos:

```text
pending_approval
approved
rejected
expired
cancelled
blocked
```

Respuesta `200`: `PaymentRequestSummary[]`, ordenada por creación descendente.

### Obtener una solicitud

```http
GET /api/v1/payment-requests/{request_id}
Authorization: Bearer <JWT>
```

Respuesta `200`:

```json
{
  "id": "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  "requester_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "payer_id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "asset_id": "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  "amount_minor": "145000000",
  "memo": "Asado del viernes",
  "status": "pending_approval"
}
```

## 15. Servicios sugeridos en el frontend

Separar el cliente HTTP de los módulos de dominio:

```text
src/services/api/
  patopayApi.ts
  profiles.api.ts
  events.api.ts
  wallets.api.ts
  policies.api.ts
  subscriptions.api.ts
  paymentRequests.api.ts
  money.ts
  types.ts
```

Ejemplo para eventos:

```ts
import { apiRequest } from './patopayApi';
import type { PatoPayEvent } from './types';

export const eventsApi = {
  list(): Promise<PatoPayEvent[]> {
    return apiRequest('/api/v1/events');
  },

  create(name: string): Promise<PatoPayEvent> {
    return apiRequest('/api/v1/events', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },
};
```

Ejemplo para crear una solicitud idempotente:

```ts
import { apiRequest } from './patopayApi';
import type { PaymentRequestCreated, UUID } from './types';

type CreatePaymentRequest = {
  payer_profile_id: UUID;
  amount_minor: string;
  asset_id: UUID;
  memo?: string;
};

export function createPaymentRequest(
  payload: CreatePaymentRequest,
  idempotencyKey: string,
): Promise<PaymentRequestCreated> {
  return apiRequest('/api/v1/payment-requests', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(payload),
  });
}
```

## 16. Orden recomendado de implementación

1. Crear `patopayApi.ts`, manejo de errores y timeout.
2. Obtener el JWT desde la sesión existente de Supabase.
3. Integrar `PUT /me` al finalizar login/onboarding.
4. Reemplazar `eventService.ts` para usar `/api/v1/events`.
5. Integrar búsqueda de perfiles.
6. Integrar listado y registro de wallets, respetando el `503` del balance Stellar.
7. Integrar policy con `expected_version` y montos string.
8. Migrar las suscripciones de servicio al backend.
9. Integrar creación/listado de PaymentRequests con `Idempotency-Key` estable.
10. Eliminar dependencias de IDs de usuario simulados como
    `EXPO_PUBLIC_PATOPAY_USER_ID` cuando todas las pantallas usen el JWT.

## 17. Flujo mínimo para una demo

```text
1. El usuario inicia sesión con Supabase Auth.
2. El frontend hace PUT /api/v1/me.
3. Crea un evento con POST /api/v1/events.
4. Lista los eventos con GET /api/v1/events.
5. Busca otro perfil por username.
6. Obtiene o configura la policy del usuario pagador.
7. Crea una PaymentRequest con Idempotency-Key.
8. Muestra status, policy_outcome y next_action.
```

No intentar mostrar ejecución Stellar, balance real ni transacción confirmada en esta
demo porque ese tramo todavía está en desarrollo.

## 18. Prueba manual

Levantar el backend:

```bash
cd backend
uv sync --frozen
uv run uvicorn patopay.main:app --reload --host 0.0.0.0 --port 8000
```

Verificar endpoints públicos:

```bash
curl --fail http://127.0.0.1:8000/health
curl --fail http://127.0.0.1:8000/ready
```

Para endpoints privados, usar un access token real de una sesión de prueba sin
pegarlo en el chat ni guardarlo en archivos versionados:

```bash
export PATOPAY_TEST_TOKEN='<access-token-temporal>'

curl --fail http://127.0.0.1:8000/api/v1/me \
  --header "Authorization: Bearer $PATOPAY_TEST_TOKEN"
```

Al terminar:

```bash
unset PATOPAY_TEST_TOKEN
```

## 19. Checklist para Tici

- [ ] `EXPO_PUBLIC_PATOPAY_API_URL` apunta al host correcto.
- [ ] El JWT proviene de `supabase.auth.getSession()`.
- [ ] Todas las llamadas privadas mandan `Authorization: Bearer ...`.
- [ ] El frontend no manda IDs para seleccionar al usuario autenticado.
- [ ] Los montos usan strings y `BigInt`, nunca `number` autoritativo.
- [ ] La misma acción conserva su `Idempotency-Key` durante reintentos.
- [ ] Los updates versionados envían `expected_version`.
- [ ] `401`, `409`, `422`, `502` y `503` tienen estados de UI diferenciados.
- [ ] `approved` no se muestra como `paid`.
- [ ] Un balance Stellar `503` no se convierte en cero.
- [ ] No se muestran transacciones ni hashes falsos.
- [ ] No se persisten ni registran tokens, claves privadas o secretos de passkey.
- [ ] Swagger abre en `/docs` y coincide con esta guía.

## 20. Contrato fuente

Si esta guía y el backend difieren, manda el contrato generado por FastAPI:

```text
http://<API_HOST>:8000/openapi.json
```

Swagger permite probarlo visualmente en:

```text
http://<API_HOST>:8000/docs
```

Antes de implementar un flujo nuevo que no aparezca en el inventario, coordinar el
endpoint con backend. No escribir directamente en las tablas privadas para evitar
saltearse validaciones, idempotencia, policies o RLS.
