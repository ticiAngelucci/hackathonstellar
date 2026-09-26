# Auditoría del backend existente

Fuente: cuatro migraciones en ../supabase/migrations, tests pgTAP, seed vacío,
función stellar-relayer y código de ../backend. No se modificaron tablas ni RLS.

## Schema real de aplicación: patopay

| Tabla | Campos / relación | Permisos authenticated |
|---|---|---|
| profiles | id → auth.users, username único, display_name, notifications_enabled | Sólo propio perfil: select/insert/update |
| events | owner_id → profiles, name, status=draft, version | Lectura owner o participante; escritura owner |
| event_participants | event_id + user_id, role owner/member | Sólo filas del usuario actual |
| assets | network=testnet, contract_address, code, decimals, enabled | Lectura activos habilitados |
| wallets | user_id, provider, network, contract_address, status, is_default, metadata pública | Sólo propias |
| mock_wallet_balances | wallet_id, balance_minor | Sólo propia wallet; no saldo blockchain |
| payment_policy_versions | user_id, version, límites minor, recipient_mode, referencia on-chain | Sólo propias |
| policy_allowed_recipients | policy_version_id + recipient_profile_id | Sólo policy propia |
| policy_allowed_assets | policy_version_id + asset_id | Sólo policy propia |
| service_subscriptions | user_id + service_id, enabled | Sólo propias |
| payment_requests | requester/payer, source/destination wallets, asset, amount_minor, status, version | Lectura ambas partes; WITH CHECK exige requester |
| policy_decisions | request, actor, action, outcome, snapshot | Lectura partes; insert actor actual/null; sin update/delete |
| payment_attempts | request, intento, estado, executor/mode, hash, receipt, error | Lectura partes; escritura payer |
| idempotency_keys | actor+method+path+key | Sólo propio actor |

profile_directory es una vista security_invoker: no permite buscar perfiles ajenos.
Trigger handle_new_auth_user crea profiles al dar de alta auth.users.
No hay RPC de negocio en estas migraciones; el trigger no es una API de pagos.
Las tablas antiguas public.events/wallets/transactions/service_subscriptions/payment_policies están revocadas.

## Restricciones encontradas

- No existen tablas/RPC de invitaciones, códigos, fondos, contribuciones, retiros, staking o push tokens.
- notifications_enabled sí existe en profiles.
- Requests no tienen event_id ni estado paid: approved NO significa pagado. Confirmación se consulta en payment_attempts.
- Payer no puede cambiar requests por el WITH CHECK actual. No existe RPC para aprobar/rechazar en su nombre.
- Wallets ajenas no se pueden consultar; no hay resolución pública de destinatarios.
- RLS usa request.jwt.claim.sub (los tests lo setean manualmente). Verificar contra PostgREST Cloud, que normalmente usa request.jwt.claims / auth.uid(). No corregir desactivando RLS.
- Membership RLS sólo muestra el participante actual; no soporta listar todos los miembros del grupo.
- No se encuentra configuración de publication supabase_realtime en migraciones.
- FastAPI expone health y events con InMemoryEventService por defecto. No expone auth, policies ni pagos persistidos.
- Relayer valida JWT y envía XDR, pero no coordina estados de requests ni enforcement de policy contra intención persistida.
- Test 002_backend_core_rls declara plan(10), pero contiene 8 aserciones: requiere corrección del test, no de la app.

## Acceso remoto y validación

Al iniciar: clave pública vacía en frontend/.env, backend/.env ausente, URL frontend distinta a README.
No hay Supabase CLI, Docker, psql ni uv disponibles en PATH. No se puede afirmar que Cloud coincide con las migraciones.
No se generó database.generated.ts: los tipos manuales documentan exclusivamente el SQL inspeccionado.
No se crean migraciones nuevas sin informar al usuario.

## Decisión de implementación

Cliente único lazy, sesión persistida y JWT real; repositorios consultan schema patopay.
TanStack Query: caché por usuario, invalidación específica y limpieza al cambiar sesión.
Demo conserva almacenamiento independiente y no crea clientes/conexiones Supabase.
Las capacidades sin soporte se muestran como no disponibles, nunca como dinero o pagos exitosos.
