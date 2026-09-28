# Pato Pay frontend

Expo + React Native + TypeScript. El frontend funciona en dos modos y no necesita
levantar Docker, Supabase local, FastAPI ni otro backend local.

## Testing frontend with remote Supabase

Requisito: Node `>=22.13.0` (ver `.nvmrc`).

1. Copiar la configuración de ejemplo:

   ```bash
   cp .env.example .env
   ```

2. Completar únicamente las credenciales públicas del proyecto:

   ```env
   EXPO_PUBLIC_DEMO_MODE=false
   EXPO_PUBLIC_SUPABASE_URL=https://ekgfskibieqljhazchno.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-o-publishable-key>
   EXPO_PUBLIC_WALLET_MODE=mock
   EXPO_PUBLIC_STELLAR_NETWORK=testnet
   ```

   `EXPO_PUBLIC_WALLET_MODE=mock` permite probar producto/Auth/Supabase sin tocar
   Stellar. Para la integración blockchain existente usar `stellar` y completar
   las variables públicas de passkey/relayer descriptas en
   [STELLAR_INTEGRATION.md](./STELLAR_INTEGRATION.md).

   Nunca usar `SUPABASE_SERVICE_ROLE_KEY`, `sb_secret_...`, seeds o private keys en
   el frontend. El cliente rechaza claves que no sean públicas.

3. Instalar y ejecutar:

   ```bash
   npm install
   npx expo start --clear
   ```

   Para web:

   ```bash
   npx expo start --web
   ```

El modo real usa `@supabase/supabase-js` directamente contra Supabase Cloud. El
esquema `patopay` debe estar expuesto en Data API, con sus migraciones, grants, RPCs
y RLS desplegados. No existe fallback a una API local.

Si el health check informa `406 / PGRST106 / Invalid schema: patopay`, abrir el
dashboard del proyecto y agregar `patopay` en **API Settings > Exposed schemas**.
Guardar el cambio, esperar su propagación y reiniciar Metro con
`npx expo start --clear`. La configuración de `supabase/config.toml` sólo describe
el entorno local y no cambia por sí sola la lista expuesta del proyecto remoto.

## Modos

- `EXPO_PUBLIC_DEMO_MODE=true`: datos determinísticos en AsyncStorage; no requiere
  Supabase, Auth remoto ni Stellar.
- `EXPO_PUBLIC_DEMO_MODE=false`: Auth, perfiles, grupos, solicitudes, reglas y
  suscripciones provienen de Supabase remoto.
- `EXPO_PUBLIC_WALLET_MODE=mock|stellar`: elige solamente la implementación de
  blockchain/wallet; no cambia la fuente de datos de producto.

Al cambiar variables de entorno, reiniciar Metro con `npx expo start --clear`.

## Arquitectura

```text
app/                         pantallas y navegación
src/config/env.ts            lectura y validación central del entorno
src/lib/supabase.ts          único cliente Supabase
src/repositories/demo/       persistencia fake determinística
src/repositories/supabase/   queries/RPCs remotos
src/services/                casos de uso y mapeos de dominio
src/hooks/                   React Query y estado de UI
src/demo/                    fixtures/config/control de demo
src/services/stellar/        blockchain
src/services/wallet/         selector mock/stellar y metadata local
src/types/                   dominio y tipos del esquema
```

Flujo de datos: `UI -> hooks -> services -> repositories`. Las pantallas no importan
el cliente Supabase. La selección demo/real vive en los repositorios.

## Health check y diagnóstico

En desarrollo, el arranque ejecuta `checkBackendConnection()` y escribe uno de estos
mensajes en consola:

```text
Supabase connected ✓
Supabase connection failed ✕
```

La ruta `/developer` existe sólo como pantalla útil en `__DEV__` y muestra modo,
conexión, Auth, user ID, environment y wallet mode. En producción redirige al inicio.

## Confirmación de email y deep links

El scheme nativo ya está declarado como `patopay` en `app.json`. El callback estable
para development builds y builds de producción es:

```text
patopay://auth/callback
```

`signUp` siempre envía ese redirect en una build nativa. El cliente Auth usa PKCE y
`app/auth/callback.tsx` intercambia el `code`, deja que Supabase persista la sesión y
envía al usuario a onboarding si todavía no tiene perfil o a Home si ya lo tiene. La
ruta también puede procesar enlaces implícitos emitidos antes de esta migración y
templates personalizados con `token_hash`; nunca imprime tokens.

### Configuración manual en Supabase

En **Authentication > URL Configuration**:

1. Cambiar el **Site URL** que hoy apunta a localhost. Si existe un dominio web real,
   usarlo. Si Pato Pay sólo es mobile por ahora, usar
   `patopay://auth/callback`; no inventar un dominio.
2. Agregar como **Redirect URL** exacta `patopay://auth/callback`.
3. `patopay://**` puede agregarse durante desarrollo nativo si se necesitan más rutas,
   pero para producción dejar preferentemente sólo el callback exacto.

En el repositorio no hay un template de confirmación personalizado activo, por lo
que el contenido remoto se debe revisar manualmente en **Authentication > Email
Templates > Confirm signup**. La opción más simple y segura es que el botón use:

```html
<a href="{{ .ConfirmationURL }}">Confirmar email</a>
```

`ConfirmationURL` incluye el `redirect_to` enviado por `signUp`. Si el template fue
personalizado y arma un enlace propio con `{{ .SiteURL }}`, reemplazar esa base por
`{{ .RedirectTo }}` y conservar `token_hash` + `type`; para este callback concreto:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Confirmar email</a>
```

El callback implementado acepta ese formato. No cambiar el template sin comprobar
primero cuál está publicado.

### Expo Go (prueba temporal)

En Expo Go se genera la URL con `Linking.createURL('/auth/callback')`, normalmente con
forma `exp://<host>:<puerto>/--/auth/callback`. Como depende de la sesión de Metro, no
se guarda ni se hardcodea. Al iniciar la app (y nuevamente al crear la cuenta), copiar
de la consola el valor exacto de:

```text
[Auth] email redirect: exp://.../--/auth/callback
```

Agregar temporalmente **ese valor exacto** a Redirect URLs antes de solicitar el
email. Si cambia el host o se reinicia Metro con otra modalidad, volver a copiarlo.
Eliminarlo al terminar; Expo Go no es la validación definitiva del deep link.

### Development build y producción

Después de cambiar configuración nativa hay que reconstruir la app. Con el workflow
actual:

```bash
npm run ios:dev
# o
npm run android:dev
```

Luego iniciar Metro para el development client con `npx expo start --dev-client --clear`.
El email debe abrir `patopay://auth/callback`. Una build standalone/producción usa el
mismo callback y no depende de Metro. No hace falta levantar un backend local.

## Qué ya usa la integración real

- Supabase Auth: sign up, sign in, sign out, sesión persistida y restaurada.
- Perfil propio y metadata de wallets registrada.
- Grupos: listar, abrir y crear. El Swagger actual no publica edición.
- Payment requests: listar, abrir y crear mediante RPC idempotente.
- Policies versionadas mediante RPC.
- Service subscriptions.
- Actividad derivada del estado persistido de las solicitudes; `approved` no se
  presenta como `paid`.
- Realtime opcional con `EXPO_PUBLIC_ENABLE_REALTIME=true`.

Estos caminos ya no usan mocks ni FastAPI. Su ejecución requiere que el proyecto
remoto tenga el schema expuesto y que sus RPC/RLS permitan el flujo autenticado.

## Qué sigue limitado o mock

- Invitaciones/membresías, fondo común, aportes, retiros y staking no tienen contrato
  remoto completo; la UI real los presenta como no disponibles.
- Aprobar/rechazar/ejecutar un request no tiene todavía un RPC seguro para el pagador.
- Crear requests requiere asset USDC, policy y wallets activas en Supabase.
- Si el remoto coincide con las migraciones locales actuales, revisar antes del E2E
  las policies de inserción de `event_participants` y el acceso cross-user seguro de
  `create_payment_request`; ver [ARCHITECTURE.md](./ARCHITECTURE.md).
- La búsqueda de otro usuario depende de los grants/RLS desplegados para
  `patopay.profile_directory`.
- La demo conserva saldo, pagos, servicios, reglas, grupos y staking fake.
- Stellar/passkeys son una integración separada; `WALLET_MODE=mock` no escribe una
  confirmación blockchain falsa en Supabase.

## Validación

```bash
npm run typecheck
npm run lint
npm test
npx expo-doctor@latest
npx expo export --platform web
```

El flujo manual recomendado para dos cuentas reales está en
[ARCHITECTURE.md](./ARCHITECTURE.md). La guía de pitch está en
[DEMO_MODE.md](./DEMO_MODE.md).
