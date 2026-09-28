# Arquitectura y auditoría del frontend

## Regla de dependencias

```text
pantalla -> hook -> service -> repository -> Supabase o demo
                                     \\-> wallet/Stellar (sólo blockchain)
```

Supabase contiene identidad y datos de producto. Stellar contiene wallet, firma,
balance y envío blockchain. Un repositorio Supabase nunca contiene lógica de firma.

## Relación con `docs/api-integration`

El Swagger externo sigue siendo el contrato funcional. Como no hay una URL remota
de FastAPI configurada, el modo real usa el JWT de Supabase y ejecuta la tabla o RPC
equivalente en el mismo proyecto Cloud:

| Contrato Swagger | Implementación directa |
| --- | --- |
| `GET/PUT/PATCH /api/v1/me` y lookup | `profiles` / `profile_directory` |
| `GET/POST /api/v1/events` | `events`, `event_participants`, RPC `create_event_with_owner` |
| wallets list/get/create/disable/balance | `wallets` y `mock_wallet_balances` |
| policy get/put | `payment_policy_versions` y RPC `replace_payment_policy` |
| service subscriptions | `service_subscriptions` |
| payment requests list/get/create | `payment_requests` y RPC `create_payment_request` |

Las operaciones que el Swagger no publica —editar eventos, invitar, aprobar, rechazar
o ejecutar pagos— permanecen deshabilitadas en modo real. La UI no infiere `paid` a
partir de `payment_attempts`: conserva el estado que forma parte del contrato.

## Inventario final

### KEPT

- `app/`, `src/components/`, `src/hooks/`: UI y navegación existentes; sólo se
  ajustaron estados reales y dependencias.
- `src/demo/`: fixtures, almacenamiento aislado, reset y tiempos determinísticos.
- `src/services/demo/demo-payment.service.ts`, `demo-wallet.service.ts` y
  `demo-staking.service.ts`: recorrido específico del pitch.
- `src/services/stellar/`, `src/services/wallet/` y passkeys: integración blockchain
  separada de los datos de producto.
- `src/features/onboarding/` y seguridad local: flujos existentes.

### MERGED / REFACTORED

- `src/services/supabaseClient.ts` -> `src/lib/supabase.ts`: un cliente persistente.
- `src/services/supabaseAuth.ts` -> Auth service/repository y
  `src/services/stellar/stellar.auth.ts` para el relayer.
- `src/services/api/money.ts` + `src/lib/money.ts` -> `src/lib/money.ts`.
- `src/services/eventService.ts` -> `src/services/groups/group.service.ts`.
- `src/services/appDataService.ts` -> servicios específicos de policies,
  subscriptions, transactions y wallet balance.
- Servicios demo de groups/policies -> `src/repositories/demo/`; las reglas de
  decisión demo viven junto al repositorio demo de policies.
- Repositorios raíz -> selectores pequeños; implementaciones concretas en
  `src/repositories/demo/` y `src/repositories/supabase/`.

### DELETED

- `src/services/api/patopayApi.ts`: dependencia de FastAPI/local eliminada.
- `src/services/api/types.ts`: DTOs de FastAPI reemplazados por tipos DB/dominio.
- `scripts/start-api-local.cjs`: ya no existe un backend local requerido.
- `scripts/test-backend-integration.cjs`: testeaba fetch/FastAPI; reemplazado por
  `scripts/test-repositories.cjs`.
- `scripts/verify-phase.ps1`: dependía de backend Python y Metro local.
- `src/services/appDataService.ts`, `src/services/eventService.ts`,
  `src/services/supabaseClient.ts`, `src/services/supabaseAuth.ts`: aliases/capas
  redundantes.
- `src/services/demo/demo-group.service.ts` y `demo-policy.service.ts`: lógica
  consolidada en repositorios demo.
- Documentos históricos de FastAPI local y verificaciones antiguas: reemplazados por
  este documento y el README actual.
- `src/types/database.ts`: alias manual duplicado; el único punto de tipos DB es
  `src/types/database.generated.ts`.

## Prueba manual real

Preparar dos usuarios válidos y datos mínimos desplegados: asset USDC habilitado,
wallets activas, policies y permisos/RLS del esquema `patopay`.

1. Configurar `DEMO_MODE=false` y arrancar Expo.
2. Crear cuenta o iniciar sesión; completar perfil.
3. Reiniciar la app y confirmar que restaura la sesión.
4. Crear un grupo, abrirlo y refrescar.
5. Con la segunda cuenta, asegurar que existe una wallet activa y una policy.
6. Desde la primera cuenta, buscar el username, crear un request y abrir el detalle.
7. Refrescar y comprobar la fila en `patopay.payment_requests`.
8. Cerrar y abrir la app; comprobar sesión, perfil, grupos y request.

Si falla la búsqueda de username pero el perfil propio funciona, revisar los grants y
RLS de `patopay.profile_directory`. Si falla la creación del request, revisar asset,
wallets activas, policy allowlist y el RPC `create_payment_request`; no agregar una
service-role key al cliente para evitar la restricción.

## Estado remoto observado

En la verificación del 26 de septiembre de 2026, el host configurado respondió `200`
en Supabase Auth, pero Data API respondió `406 / PGRST106` para el schema `patopay`.
Esto significa que la conexión y la public key son válidas, pero `patopay` todavía no
está en la lista de schemas expuestos de ese proyecto (o la configuración API aún no
se propagó). El flujo real de datos queda bloqueado hasta exponer `patopay` en la
configuración de Data API y confirmar que las migraciones/grants/RLS están desplegados.

### Revisión estática de los RPC locales

Si el proyecto remoto coincide con `../supabase/migrations`, todavía hay dos casos
que deben probarse/corregirse en una migración remota antes de afirmar que el E2E está
completo:

- `create_event_with_owner` es `security invoker`, pero la migración posterior deja
  `event_participants` con una policy sólo para `SELECT`. La inserción del owner puede
  ser rechazada por RLS.
- `create_payment_request` es `security invoker`; las policies de `wallets` y
  `payment_policy_versions` sólo permiten ver filas propias. El requester no puede
  leer la wallet ni la policy del payer y el RPC puede concluir que no existen.

Los tests pgTAP actuales verifican presencia, grants y RLS, pero no ejecutan estos
RPC como dos usuarios autenticados. La corrección debe preservar RLS mediante RPCs
acotados y auditables; no se debe otorgar acceso `anon`, desactivar RLS ni incluir una
service-role key en el frontend.
