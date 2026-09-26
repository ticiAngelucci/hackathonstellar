# Integración de Pato Pay — estado y pruebas

La implementación cliente se trabajó en las ocho fases solicitadas, con controles
locales antes de avanzar. **No está verificada contra Supabase Cloud ni constituye
un flujo de pago completo**: falta configurar el acceso público y confirmar el
contrato desplegado. El código se adaptó al SQL y al backend del repositorio.

## A. Backend encontrado

Detalle de tablas, relaciones y RLS: [BACKEND_AUDIT.md](BACKEND_AUDIT.md).

El esquema de aplicación es `patopay`: profiles, events, event_participants,
assets, wallets, mock_wallet_balances, payment_policy_versions,
policy_allowed_recipients, policy_allowed_assets, service_subscriptions,
payment_requests, policy_decisions, payment_attempts e idempotency_keys.
`profiles.id` referencia Auth; requests relacionan dos perfiles, dos wallets y un
asset; attempts pertenecen a requests; restricciones pertenecen a versiones de policy.

RLS está forzada y limita datos por identidad/participación. El trigger de Auth crea
el perfil. No hay RPC de negocio en las migraciones inspeccionadas. La vista
profile_directory no habilita buscar perfiles ajenos. El relayer envía XDR firmado,
pero no coordina requests/policies/intentos. FastAPI usa eventos en memoria por defecto.

## B. Integraciones implementadas en el cliente

| Fase | Implementación | Límite pendiente |
|---|---|---|
| 1 | Cliente único, sesión persistente, email/password, perfil, preferencias y metadata pública de wallet | Configuración Cloud, confirmación de email, RLS y prueba física de passkey |
| 2 | Listar/crear/abrir/renombrar eventos como grupos, membresía propia, control de versión | No hay invitaciones; RLS impide listar todos los miembros |
| 3 | Lectura de requests e intentos, mappers, creación por servicio con referencias conocidas | No hay selector autorizado de destinatarios/wallets ni UI de creación; aprobación/rechazo no soportados por contrato actual |
| 4 | Leer reglas y guardar nuevas versiones simples, validación de importes y versión | Restricciones y referencias on-chain se protegen contra reemplazo; no se replica on-chain |
| 5 | Actividad desde requests/intentos, saldo Stellar, hash/explorer | No existe indexador para incorporar todos los envíos directos de wallet |
| 6 | Preferencias de servicios persistidas, optimistic update y rollback | Activar una preferencia no ejecuta pagos recurrentes |
| 7 | Vista de fondo vinculada al grupo autorizado | Sin balance, aportes, retiros o staking inventados; disponible próximamente |
| 8 | Realtime por usuario e IDs visibles, invalidación y cleanup | Desactivado por defecto hasta comprobar publication y RLS |

La UI consume hooks/servicios; repositorios encapsulan Supabase. TanStack Query
mantiene caché por identidad y la limpia al cambiar de cuenta. Onboarding y metadata
de wallet locales usan claves separadas por usuario. La metadata antigua sin dueño
no se asocia automáticamente a una cuenta nueva; recuperar una wallet previa requiere
un flujo explícito de recuperación, que no se implementó aquí.

Face ID sigue siendo bloqueo local; Supabase identifica al usuario y la passkey
autoriza blockchain. El onboarding conserva un borrador y persiste perfil, primera
policy, preferencias y metadata pública al finalizar. Ese guardado abarca varias
operaciones, no una transacción SQL: un error permite reintentar, pero puede dejar
parte de los datos guardados. La wallet se registra como `unverified` hasta una
verificación confiable externa; el cliente no certifica que ya esté verificada.

`approved` no se muestra como `paid`. Los intentos mock nunca confirman dinero real.
La actividad refleja los estados registrados por el backend; la pantalla de éxito
consulta además Stellar. Esto no sustituye un coordinador que valide importe,
destinatario, policy, idempotencia y confirmación de la operación completa.

## C. Qué sigue usando mock

Demo conserva servicios, saldos, grupos, pagos y almacenamiento independientes.
En modo real no se usan fixtures para Home, perfil, grupos, requests o actividad.
El selector de wallet usa Stellar cuando DEMO_MODE=false, incluso si quedó un valor
legacy WALLET_MODE=mock. El mock antiguo permanece en el código para pruebas aisladas.

El catálogo de nombres/iconos de servicios es presentación local; los toggles vienen
de `service_subscriptions`. El recorrido educativo marca sus importes como ejemplos
en modo real. Sus fondos/staking indican disponibilidad futura. La demo mantiene
el texto limpio para grabación y usa el nombre elegido por el usuario.

## D. Backend que todavía no tiene vista completa

- Edición detallada de allowlists de destinatarios/assets y sincronización on-chain.
- Inspección de policy_decisions, receipts y todos los intentos históricos.
- Gestión de varias wallets, recuperación y verificación confiable de wallets.
- Creación de requests desde referencias autorizadas: el servicio existe, falta un
  contrato para resolver destinatarios y una pantalla que lo use.
- Paginación histórica: solicitudes se limitan a 100 y lectura de intentos a 500.

## E. Vistas sin soporte suficiente en el backend inspeccionado

Invitar/aceptar miembros, listar otros miembros, fondo común, contribuciones, retiros,
staking, ejecución recurrente y registro de push tokens. La preferencia de
notificaciones sí se guarda. Requests no tienen relación con grupo en el SQL actual.
El pagador no puede aprobar/rechazar por el WITH CHECK actual; no se puenteó con
permisos elevados. Los botones lo explican y no producen una falsa confirmación.

## F. Configuración necesaria

Copiar los valores públicos correctos del proyecto a `.env` siguiendo `.env.example`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon JWT o sb_publishable_...>
EXPO_PUBLIC_DEMO_MODE=false
EXPO_PUBLIC_WALLET_MODE=stellar
EXPO_PUBLIC_ENABLE_REALTIME=false
EXPO_PUBLIC_STELLAR_NETWORK=testnet
EXPO_PUBLIC_STELLAR_RELAYER_URL=<URL HTTPS del relayer existente>
EXPO_PUBLIC_PASSKEY_RP_ID=<dominio configurado para passkeys>
EXPO_PUBLIC_PASSKEY_ALLOWED_ORIGINS=<origenes autorizados separados por coma>
```

Se admite `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` como alias legacy si ANON_KEY está vacío.
No se muestran ni se copian aquí valores de `.env`. Al revisar, no había clave
pública y la URL difería de la documentada en `../supabase/README.md`; confirmar el
proyecto correcto en Supabase, sin deducirlo ni reemplazarlo automáticamente.
Tras configurar, reiniciar Expo con `npx expo start --clear` y recargar la aplicación.
Passkeys nativas requieren un development build compatible y su asociación de dominio;
un bundle exitoso no verifica esas capacidades en Expo Go.

## G. Cambios de backend que necesitan evaluación

No se crearon ni ejecutaron migraciones y no se modificaron RLS.
Antes de proponer cambios, comparar Cloud con las migraciones locales:

1. Verificar que Data API expone `patopay` y que la identidad de las policies funciona
   con JWT reales. Las policies locales leen `request.jwt.claim.sub`; no asumir que
   las pruebas que lo setean manualmente equivalen a PostgREST desplegado.
2. Si tampoco existe remotamente, falta una operación confiable para aprobar/rechazar
   y ejecutar requests, con idempotencia, validación de wallets/policy y confirmación.
3. Resolver consulta autorizada de destinatarios y membresías antes de crear UI de invitación.
   Nuevas tablas/RPC para invitaciones, fondos o staking requieren acordar primero el modelo.
4. Publicar sólo las tablas necesarias en Realtime después de verificar acceso con dos usuarios.
5. Corregir el plan de `002_backend_core_rls`: declara 10 pruebas y contiene 8 aserciones.

Tipos en `src/types/database.ts` son manuales y están identificados como tales.
Cuando haya CLI y acceso al proyecto, generar tipos del esquema real y contrastarlos:

```powershell
supabase gen types typescript --project-id <project-ref> --schema patopay |
  Set-Content -Encoding utf8 src/types/database.generated.ts
```

No sobrescribir un archivo generado a mano ni conectarlo sin revisar las diferencias.

## H. Cómo probar

### Controles locales reproducibles

Desde `frontend`, instalar dependencias con `npm ci`. Para el bundle real abrir una
terminal y ejecutar:

```powershell
$env:EXPO_PUBLIC_DEMO_MODE='false'
$env:EXPO_OFFLINE='1'
npx expo start --port 8090 --clear
```

En otra terminal:

```powershell
npm run typecheck
npm run lint
npm test
```

La prueba de repositorios usa respuestas controladas: valida filtros, errores,
estados, límites, aislamiento y limpieza; no ejecuta SQL ni prueba las RLS remotas.
Para reproducir también los tests Python, con el entorno existente:

```powershell
$env:PYTHONPATH=(Resolve-Path ../backend/src).Path
$env:PYTHONDONTWRITEBYTECODE='1'
.cache/backend-venv/Scripts/python.exe -m pytest ../backend/tests -p no:cacheprovider
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-phase.ps1 -Phase 8
```

Ese entorno se preparó con Python 3.12 y dependencias del pyproject. Para otra máquina,
instalar el backend según sus instrucciones antes de correr pytest. El script de fase
requiere ese entorno y Metro en 8090; registra una fila sólo si todos los checks pasan.

### Prueba manual con dos cuentas reales A y B

Estas pruebas quedan pendientes hasta disponer de configuración Cloud correcta:

1. **Auth/perfil:** crear A con email/password; confirmar email si el proyecto lo exige
   e iniciar sesión. Elegir nombre/username, completar la wallet con la passkey real
   y terminar onboarding. Verificar su fila propia de perfil y preferencias. Cerrar
   y reabrir la app: debe mantener sesión y nombre. Editar el nombre en Perfil,
   recargar Home y comprobar el mismo nombre. Cerrar sesión y entrar como B:
   no deben aparecer datos, borradores ni wallet de A.
2. **Grupos:** en A abrir Grupos, crear uno, abrirlo y renombrarlo; reiniciar y comprobar
   persistencia. B no debe verlo si no tiene membresía. Con una membresía preparada
   por el backend autorizado, B debe poder leerlo y no renombrarlo como dueño.
   Invitaciones y el listado completo de miembros deben permanecer no disponibles.
3. **Requests:** usar solicitudes de prueba existentes/preparadas por el backend con
   perfiles, wallets y asset válidos; no hay seed de negocio. Verlas desde las dos
   partes y comprobar que un tercero no las ve. Abrir `/payment/request?id=<id>`.
   Comprobar pendiente/aprobada/rechazada/bloqueada y los estados de intentos registrados.
   Aprobar/rechazar deben informar que aún no están habilitados. Un registro aprobado
   sin intento confirmado no debe aparecer pagado, ni un intento mock convertirse
   en pago real. No insertar confirmaciones ficticias para simular validación blockchain.
4. **Policies:** abrir Mis reglas, guardar límites simples, recargar y comprobar una
   nueva versión. Intentar guardar desde una vista desactualizada debe fallar. Una
   policy con restricciones o referencia on-chain debe verse protegida contra edición.
   Guardar preferencias no debe disparar un pago.
5. **Servicios:** activar un servicio, reiniciar y comprobar persistencia. Desconectar
   la red e intentar cambiarlo: el toggle debe volver a su valor previo y mostrar error.
6. **Actividad:** contrastar requests/intentos visibles contra Cloud; revisar signos,
   importes, asset y estados. Abrir explorer para un hash Stellar válido. Un envío
   directo de wallet aún no garantiza una fila en Actividad: falta indexación/coordinación.
7. **Realtime:** primero comprobar publication/RLS de las tablas en Cloud; luego
   activar ENABLE_REALTIME y reiniciar. Con A mirando requests, crear/modificar una
   solicitud autorizada desde B/backend; debe aparecer sin refrescar. Repetir con un
   tercero que no participa: no debe recibir los datos. Cerrar sesión y comprobar
   que se limpia el canal. Verificar aviso de desconexión; IDs se limitan a 100 por filtro.
8. **Demo:** poner DEMO_MODE=true, reiniciar Expo y seguir [DEMO_MODE.md](DEMO_MODE.md).
   Probar nombre compartido, aprobación 10 USDC, automático 3, bloqueo 100 y reset;
   no debe requerir Supabase ni firmar en Stellar, ni modificar datos reales.

Resultados locales por fase: [PHASE_VERIFICATION.md](PHASE_VERIFICATION.md).
Último pase: TypeScript OK; ESLint sin errores (18 warnings); regresiones demo y
repositorios OK; 46 tests Python OK; bundles Metro web real/demo y Android real OK.
No se ejecutaron pgTAP, pruebas Cloud ni una sesión visual en dispositivo físico.

## I. Seguridad

Esta integración no agregó private keys, seeds ni service-role keys al frontend.
El cliente rechaza claves `service_role` y `sb_secret_`; acepta sólo claves públicas.
La wallet persiste dirección y metadata pública, nunca material de firma privado.
No se deshabilitó RLS, no se cambiaron grants y no se desplegaron funciones ni SQL.
La autorización final sigue dependiendo de RLS y los servicios confiables existentes.
