# Integración del frontend con Pato Pay

La referencia funcional está en `../docs/api-integration.md` y en el Swagger
`../docs/patopay-api-reference.html`. El frontend conserva esos DTOs, validaciones y
semántica, pero en modo real se conecta directamente al proyecto remoto de Supabase;
no requiere ejecutar FastAPI ni otro backend local.

## Transporte actual

```text
pantalla -> hook -> service -> repository -> Supabase Cloud
                                      \-> demo local

wallet/passkey -> wallet service -> mock o Stellar Testnet
```

- Auth usa `supabase.auth` y sesión persistida.
- Datos de producto usan el schema `patopay` con el JWT del usuario y RLS.
- Escrituras transaccionales usan los RPC publicados por las migraciones.
- Stellar no vive dentro de repositories Supabase.

## Mapeo del Swagger

| Operación documentada | Implementación del frontend |
| --- | --- |
| health / ready | `checkBackendConnection()` sólo en desarrollo |
| get / put / patch me | `profiles` |
| lookup profile | `profile_directory` |
| list / create events | `events`, `event_participants`, `create_event_with_owner` |
| list / get / create / disable wallet | `wallets` |
| mock wallet balance | `mock_wallet_balances` |
| get / replace policy | tablas de policy y `replace_payment_policy` |
| list / update subscriptions | `service_subscriptions` |
| list / get / create payment request | `payment_requests` y `create_payment_request` |

No se implementan en modo real operaciones ausentes del Swagger: editar eventos,
invitar miembros, aprobar/rechazar requests o ejecutar pagos. `approved` significa
que la policy lo permite; no significa `paid`.

## Auth y confirmación de email

- Callback nativo estable: `patopay://auth/callback`.
- Expo Go genera su callback temporal con `Linking.createURL`.
- El cliente nuevo usa PKCE y `exchangeCodeForSession`.
- La ruta mantiene compatibilidad con enlaces implícitos ya enviados y con templates
  que entregan `token_hash`.
- Demo Mode no llama Auth ni envía emails.

La configuración manual del Dashboard y los pasos de prueba están en la sección
“Confirmación de email y deep links” del `README.md`.

## Requisitos del proyecto remoto

1. `patopay` debe figurar en **API Settings > Exposed schemas**.
2. Deben estar desplegadas las migraciones, grants, RLS y RPC del schema.
3. La public anon/publishable key debe ser válida; nunca usar service role en la app.
4. Authentication debe permitir `patopay://auth/callback` como Redirect URL.

Mientras el remoto responda `PGRST106`, Auth puede funcionar pero los datos de
producto no: ese error confirma que la Data API todavía no expone `patopay`.

## Validación

```bash
npm run typecheck
npm test
npm run lint
npx expo-doctor@latest
npx expo export --platform web
```

Para probar datos reales no se levanta backend local: configurar `.env`, usar
`EXPO_PUBLIC_DEMO_MODE=false` y ejecutar `npx expo start --clear`.
