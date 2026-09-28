# Terminar Stellar, smart wallet, policy on-chain, relayer, reconciliación y x402

## Goal

Completar un recorrido verificable en Stellar Testnet donde un `PaymentRequest` de PatoPay se aprueba, se convierte en un pago x402 `exact` de USDC, se firma localmente con una passkey, se liquida mediante un facilitator/relayer y sólo se marca `paid` después de reconciliar evidencia on-chain.

## Current context / assumptions

### Repositorio y baseline observado

- Repositorio: `/home/jhaycortez/code/f-projects/f-pato_pay`.
- Rama al escribir este plan: `main...origin/main`, worktree limpio.
- Backend: FastAPI dentro de `backend/`; Supabase se consume únicamente por Auth/PostgREST/RPC, sin SQLAlchemy, Psycopg, DSN ni conexión PostgreSQL directa.
- Frontend: Expo/React Native dentro de `frontend/`.
- Persistencia: schema privado `patopay` en Supabase Cloud.
- Backend actual: `pytest`, Ruff, format check y mypy pasan.
- Frontend actual:
  - `npm test` pasa;
  - ESLint tiene 0 errores y 19 warnings;
  - `npm run typecheck` falla en `frontend/src/features/auth/AuthProvider.tsx:39` porque `useSegments()` se infiere como tupla de un elemento.
- Supabase Cloud al auditar:
  - `patopay.assets`: vacío;
  - `patopay.payment_requests`: vacío;
  - `patopay.payment_attempts`: vacío;
  - Edge Functions desplegadas: ninguna.
- El source `supabase/functions/stellar-relayer/index.ts` existe, pero no está desplegado.
- El frontend tiene código para `PasskeyKit.createWallet`, `SACClient.transfer`, firma local y envío de XDR, pero faltan configuración, tests Stellar específicos y una prueba E2E.
- Sin overrides, el frontend usa XLM nativo; no USDC.
- El backend sólo tiene `MockPaymentExecutor`; configurar `stellar` sin adapter provoca un error de arranque deliberado.
- x402 aparece en documentación, pero no hay middleware, endpoints, headers, facilitator client ni tests.

### Decisiones de arquitectura que este plan fija

1. **Autocustodia:** ninguna seed `S…`, private key, secreto WebAuthn o XDR reutilizable entra en FastAPI, Supabase o logs. La passkey firma en el dispositivo.
2. **Identidad:** FastAPI deriva al actor exclusivamente de `sub` del JWT de Supabase. Los endpoints financieros no aceptan un `userId` para elegir identidad.
3. **Rail:** x402 v2, scheme `exact`, network `stellar:testnet`, token SEP-41/SAC de USDC Testnet.
4. **USDC canónico de Testnet:** usar el contract ID publicado en el spec oficial x402 Stellar:

   ```text
   CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA
   ```

   Verificarlo contra Soroban RPC antes de aplicar la seed remota; el ticker `USDC` nunca es identidad suficiente.
5. **Montos:** enteros en unidades base, escala 7, JSON como string decimal canónico; nunca `float`/`number` como valor autoritativo.
6. **Estados separados:** `approved` es consentimiento/policy; `submitted` es aceptación del envío; `paid` requiere confirmación verificable.
7. **Backend como resource server:** FastAPI produce `PAYMENT-REQUIRED`, recibe `PAYMENT-SIGNATURE`, llama al facilitator y persiste/reconcilia. El frontend no escribe tablas financieras directamente.
8. **Dos responsabilidades externas distintas:**
   - el relayer de `passkey-kit` despliega/administra la smart wallet con XDR firmado;
   - el facilitator x402 verifica y liquida transferencias USDC.
9. **Policy on-chain:** una policy Soroban compartida mantiene configuración y gasto por wallet. La passkey queda restringida para transferencias USDC de modo que el smart wallet exija también esa policy. La passkey conserva capacidad de administración y configuración.
10. **“Auto” honesto:** en este alcance la policy puede auto-aprobar, pero la transferencia requiere presencia local para la passkey. Pago desatendido necesitaría una session key/agent key revocable y acotada; no se simula guardando una seed en servidor.
11. **Timeout seguro:** si el facilitator puede haber enviado pero no devuelve resultado inequívoco, el intento pasa a `unknown`; no se genera automáticamente un segundo pago.
12. **Facilitator inicial:** usar el facilitator público x402 sólo para Testnet después de comprobar `GET /supported`. Producción/mainnet queda fuera de este plan.

### Fuentes primarias que gobiernan la implementación

- x402 HTTP v2: <https://docs.x402.org/core-concepts/http-402>
- x402 facilitator: <https://docs.x402.org/core-concepts/facilitator>
- x402 exact: <https://docs.x402.org/schemes/exact>
- x402 Stellar exact spec: <https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_stellar.md>
- x402 network/token support: <https://docs.x402.org/core-concepts/network-and-token-support>
- passkey-kit v0.19.1 tag: commit `4e24eb1005d893dab1cf3dab08ba49f2c3df7069`
- passkey-kit policy interface/sample policy: <https://github.com/stellar/passkey-kit/tree/v0.19.1/contracts>

Do not continue if live package APIs or the Testnet facilitator contradict these contracts; document the mismatch and replan instead of adding private-key custody.

## Architecture / proposed approach

Implementar primero un vertical slice Stellar seguro y persistente: asset USDC canónico, wallets verificadas, decisiones explícitas, intento de pago, firma local, settlement y reconciliación. Encima de ese rail, FastAPI actuará como x402 resource server y el cliente móvil usará `@x402/stellar` con un `ClientStellarSigner` custom respaldado por `PasskeyKit.signAuthEntry`, nunca por `createEd25519Signer`.

La policy off-chain decide consentimiento y crea un snapshot; la policy Soroban replica sólo invariantes financieras mínimas — contrato USDC, `from`, destinatario, límite por transferencia, límite acumulado y revisión — y las hace cumplir en `__check_auth`. Supabase conserva intención, intentos, hashes y receipts sanitizados; no conserva la autorización firmada.

## API final objetivo

| Método | Ruta | Resultado |
|---|---|---|
| `GET` | `/api/v1/assets` | Assets habilitados; USDC Testnet canónico |
| `POST` | `/api/v1/me/wallets` | Registra metadata pública de smart wallet |
| `POST` | `/api/v1/me/wallets/{wallet_id}/verify` | Verifica deploy/hash y activa wallet |
| `GET` | `/api/v1/me/wallets/{wallet_id}/balance` | Balance USDC real o error explícito |
| `POST` | `/api/v1/payment-requests/{id}/approve` | Registra consentimiento, no paga |
| `POST` | `/api/v1/payment-requests/{id}/reject` | Rechaza de forma versionada |
| `POST` | `/api/v1/payment-requests/{id}/settle` sin `PAYMENT-SIGNATURE` | Crea/reusa intento y responde `402` + `PAYMENT-REQUIRED` |
| `POST` | `/api/v1/payment-requests/{id}/settle` con `PAYMENT-SIGNATURE` | Verifica/liquida; `200 confirmed` o `202 submitted/unknown` |
| `GET` | `/api/v1/payment-requests/{id}/attempts` | Historial visible a payer/requester |
| `POST` | `/api/v1/payment-attempts/{id}/refresh` | Reconciliación idempotente por evidencia on-chain |
| `POST` | `/api/v1/me/payment-policy/on-chain/activate` | Guarda contract/revision sólo tras attach/config confirmado |

### State machine

```text
PaymentRequest
pending_approval ──approve──> approved
pending_approval ──reject───> rejected
approved ──prepare──> processing
processing ──confirmed attempt──> paid
processing ──terminal failure───> failed
processing + unknown attempt ───> processing

PaymentAttempt
prepared ──consume signature──> submitting
submitting ──facilitator accepted──> submitted
submitting ──timeout/ambiguous─────> unknown
submitted/unknown ──chain success─> confirmed
submitted/unknown ──chain failure─> failed
```

No transición puede convertir un mock/simulation en `paid`, ni convertir un timeout en `failed` si la operación pudo haber sido enviada.

---

## Step-by-step tasks

Cada subpaso es una unidad corta. Para cada cambio de comportamiento: RED → verificar el fallo esperado → GREEN mínimo → suite relevante → refactor → commit. No acumular varios RED antes de implementar el primero.

### Phase 0 — Preflight reproducible

1. Confirmar repositorio y estado:

   ```bash
   cd /home/jhaycortez/code/f-projects/f-pato_pay
   git rev-parse --show-toplevel
   git status --short --branch
   git log -5 --oneline --decorate
   ```

   Esperado: root exacto del repo, rama `main`, sin merge/rebase y sin cambios inesperados. Si aparecen cambios ajenos, no hacer stash/reset; anotarlos y stagear sólo archivos propios.

2. Crear rama de implementación:

   ```bash
   git switch -c feat/stellar-x402-settlement
   ```

3. Capturar baseline backend:

   ```bash
   cd backend
   uv sync --frozen
   uv run pytest -q
   uv run ruff check .
   uv run ruff format --check .
   uv run mypy src
   ```

   Esperado: todo verde. Guardar el número real de tests en el reporte final.

4. Capturar baseline frontend:

   ```bash
   cd ../frontend
   npm ci
   npm test
   npm run lint
   npm run typecheck
   ```

   Esperado: tests PASS, lint sin errores y typecheck RED únicamente por `AuthProvider.tsx:39`.

5. Confirmar herramientas de contratos sin instalarlas todavía:

   ```bash
   rustc --version
   cargo --version
   stellar --version
   rustup target list --installed | grep wasm32v1-none
   ```

   Esperado final de esta fase: baseline documentado; si faltan Rust/Stellar CLI, instalar en la fase de contratos usando documentación oficial y registrar versiones.

### Phase 1 — Reparar el baseline TypeScript antes de tocar pagos

1. **RED existente:** ejecutar:

   ```bash
   cd frontend
   npm run typecheck
   ```

   Esperado: `TS2493` en `src/features/auth/AuthProvider.tsx:39`.

2. En `frontend/src/features/auth/AuthProvider.tsx`, tipar segmentos sin indexar una tupla cerrada:

   ```ts
   const segments = useSegments() as readonly string[];
   const root = segments.at(0);
   const step = segments.at(1);
   ```

   Aplicar la misma forma en `AuthBoundary` y `NavigationGuard`; no cambiar navegación.

3. **GREEN:** ejecutar:

   ```bash
   npm run typecheck
   npm test
   npm run lint
   ```

   Esperado: typecheck y tests PASS; lint 0 errores. No convertir warnings ajenos en alcance de esta corrección.

4. Commit exacto:

   ```bash
   git add frontend/src/features/auth/AuthProvider.tsx
   git commit -m "fix: type auth navigation segments"
   ```

### Phase 2 — Agregar harness unitario para Stellar/x402

1. Instalar versiones explícitas:

   ```bash
   cd frontend
   npm install --save-exact @x402/core@2.27.0 @x402/stellar@2.27.0 @x402/fetch@2.27.0
   npm install --save-dev --save-exact vitest@5.0.2
   ```

2. En `frontend/package.json`, agregar sin quitar los scripts existentes:

   ```json
   {
     "scripts": {
       "test:unit": "vitest run",
       "test:all": "npm test && npm run test:unit"
     }
   }
   ```

3. Crear `frontend/vitest.config.ts`:

   ```ts
   import {fileURLToPath,URL} from 'node:url';
   import {defineConfig} from 'vitest/config';

   export default defineConfig({
     resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},
     test:{environment:'node',include:['src/**/*.test.ts']},
   });
   ```

4. Crear `frontend/src/services/x402/x402-passkey-signer.test.ts` con un primer RED que importe `createPasskeyStellarSigner` y compruebe:
   - `address` es la `C…` esperada;
   - `signAuthEntry` delega al callback inyectado;
   - rechaza si `opts.address` no coincide;
   - rechaza si la network passphrase no es Testnet.

5. Ejecutar RED:

   ```bash
   npm run test:unit -- x402-passkey-signer.test.ts
   ```

   Esperado: fallo por módulo inexistente, no por configuración de Vitest.

6. Implementar `frontend/src/services/x402/x402-passkey-signer.ts` con esta interfaz mínima y sin importar secretos:

   ```ts
   import type {ClientStellarSigner} from '@x402/stellar';
   import {Networks,xdr} from '@stellar/stellar-sdk';

   type SignEntry = (entry:xdr.SorobanAuthorizationEntry)=>Promise<xdr.SorobanAuthorizationEntry>;

   export function createPasskeyStellarSigner(address:string,signEntry:SignEntry):ClientStellarSigner{
     return {
       address,
       async signAuthEntry(authEntry,options){
         if(options?.address&&options.address!==address)throw new Error('x402 intentó firmar con otra wallet.');
         if(options?.networkPassphrase&&options.networkPassphrase!==Networks.TESTNET){
           throw new Error('x402 intentó firmar para otra red.');
         }
         const decoded=xdr.SorobanAuthorizationEntry.fromXDR(authEntry,'base64');
         const signed=await signEntry(decoded);
         return {signedAuthEntry:signed.toXDR('base64'),signerAddress:address};
       },
     };
   }
   ```

7. Ejecutar GREEN y gate:

   ```bash
   npm run test:unit -- x402-passkey-signer.test.ts
   npm run typecheck
   npm run test:all
   ```

8. Commit:

   ```bash
   git add frontend/package.json frontend/package-lock.json frontend/vitest.config.ts frontend/src/services/x402
   git commit -m "test: establish x402 stellar client harness"
   ```

### Phase 3 — Probar compatibilidad x402 ↔ smart wallet con passkey

Esta fase es un gate. No continuar a infraestructura si falla.

1. Agregar a `frontend/src/services/x402/x402-passkey-signer.test.ts` un fixture de `SorobanAuthorizationEntry` para una transferencia SAC cuyo `credentials.address` sea una wallet `C…`.
2. Usar `ExactStellarScheme` de `@x402/stellar/exact/client` con el signer custom, requirements:

   ```ts
   const requirements={
     scheme:'exact',
     network:'stellar:testnet',
     amount:'1000000',
     asset:'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
     payTo:destination,
     maxTimeoutSeconds:60,
     extra:{},
   } as const;
   ```

3. **RED:** verificar que el primer test falla porque falta el adapter que conecta `PasskeyKit.signAuthEntry`.
4. Exponer una función package-private en `frontend/src/services/wallet/stellar-wallet.service.ts`:

   ```ts
   export async function getConnectedPasskeySigner(){
     const service=new StellarWalletService();
     const {kit,account}=await service.requireConnectedKitForX402();
     return createPasskeyStellarSigner(account.walletAddress,entry=>kit.signAuthEntry(entry));
   }
   ```

   No duplicar inicialización de `PasskeyKit`; refactorizar `requireConnectedKit` a una función del módulo o método accesible sólo dentro del package. No exponer `kit` a componentes React.

5. GREEN:

   ```bash
   npm run test:unit -- x402-passkey-signer.test.ts
   npm run typecheck
   ```

6. Agregar un fixture negativo donde el esquema solicita otro asset, amount o `payTo`; comprobar que el payload construido no se firma cuando no coincide con el PaymentRequest esperado.
7. Commit:

   ```bash
   git add frontend/src/services/x402 frontend/src/services/wallet/stellar-wallet.service.ts
   git commit -m "feat: adapt passkey wallet to x402 stellar signer"
   ```

**Stop condition:** si `@x402/stellar` 2.27.0 no soporta `ClientStellarSigner` con dirección `C…` o exige `signTransaction`, detenerse. No usar `createEd25519Signer`, no generar una seed y no guardar una clave como workaround.

### Phase 4 — Registrar USDC Testnet canónico y exponer assets

1. Crear RED API en `backend/tests/api/test_assets_api.py`:
   - `GET /api/v1/assets` exige JWT;
   - consulta `patopay.assets` con `network=eq.testnet`, `code=eq.USDC`, `enabled=eq.true`;
   - serializa `decimals` como entero y contract ID exacto.
2. Ejecutar:

   ```bash
   cd backend
   uv run pytest tests/api/test_assets_api.py -q
   ```

   Esperado: 404 o router inexistente.

3. Crear:
   - `backend/src/patopay/api/schemas/assets.py`;
   - `backend/src/patopay/api/routes/assets.py`;
   - ampliar `backend/src/patopay/application/use_cases/assets.py` con `list_enabled()`;
   - registrar router en `backend/src/patopay/main.py`.

   Schema:

   ```py
   class AssetResponse(ApiModel):
       id: UUID
       network: Literal["testnet"]
       contract_address: str
       code: str
       decimals: int
       enabled: bool
   ```

4. GREEN:

   ```bash
   uv run pytest tests/api/test_assets_api.py -q
   uv run pytest -q
   ```

5. Crear `supabase/migrations/20260927212000_seed_stellar_testnet_usdc.sql`:

   ```sql
   insert into patopay.assets (network, contract_address, code, decimals, enabled)
   values (
     'testnet',
     'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
     'USDC',
     7,
     true
   )
   on conflict (network, contract_address)
   do update set code = excluded.code, decimals = excluded.decimals, enabled = true;
   ```

6. Crear `supabase/tests/database/007_usdc_asset.test.sql` con pgTAP que compruebe exactamente una fila habilitada, code, decimals y contract ID.
7. Ejecutar local/linked según disponibilidad:

   ```bash
   npx supabase test db --linked --debug
   ```

   Esperado: todos los archivos y assertions PASS. Si la migration aún no está remota, correr antes el flujo de dry-run de Phase 16.

8. Commit:

   ```bash
   git add backend/src/patopay/api backend/src/patopay/application/use_cases/assets.py backend/src/patopay/main.py backend/tests/api/test_assets_api.py supabase/migrations/20260927212000_seed_stellar_testnet_usdc.sql supabase/tests/database/007_usdc_asset.test.sql
   git commit -m "feat: expose canonical testnet USDC asset"
   ```

### Phase 5 — Eliminar la identidad de asset por UUID configurado en el frontend

1. RED en `frontend/src/services/payments/payment.service.test.ts`: crear PaymentRequest debe resolver USDC desde `GET /api/v1/assets`, no desde `EXPO_PUBLIC_PATOPAY_USDC_ASSET_ID`.
2. Crear `frontend/src/repositories/asset.repository.ts` y `frontend/src/services/assets/asset.service.ts`:

   ```ts
   export type ApiAsset={id:string;network:'testnet';contract_address:string;code:'USDC';decimals:7;enabled:true};
   export const assetRepository={list:()=>apiRequest<ApiAsset[]>('/api/v1/assets')};
   export async function requireUsdcAsset(){
     const assets=await assetRepository.list();
     const asset=assets.find(item=>item.code==='USDC'&&item.network==='testnet'&&item.enabled);
     if(!asset)throw new AppError('USDC Testnet no está habilitado.','configuration');
     return asset;
   }
   ```

3. Cambiar `frontend/src/services/payments/payment.service.ts` para usar `requireUsdcAsset().id`.
4. Eliminar uso de `configuredAssetId()` y `requireAssetId()` en el flujo real; borrar helpers si quedan sin consumidores.
5. Quitar `EXPO_PUBLIC_PATOPAY_USDC_ASSET_ID` de `frontend/.env.example` y documentación; no tocar `.env.local` del usuario.
6. GREEN:

   ```bash
   npm run test:unit -- payment.service.test.ts
   npm run typecheck
   npm run test:all
   ```

7. Commit: `feat: resolve USDC asset through FastAPI`.

### Phase 6 — Decisiones manuales approve/reject atómicas

1. Crear `supabase/tests/database/008_payment_decisions.test.sql` con RED para RPC `patopay.decide_payment_request(uuid,text,integer,text)`:
   - sólo payer puede decidir;
   - `approve` sólo desde `pending_approval`;
   - `reject` sólo desde `pending_approval`;
   - `expected_version` stale produce conflicto;
   - la decisión es append-only;
   - misma idempotency key + mismo payload devuelve la misma respuesta;
   - misma key + distinto payload falla.
2. Ejecutar RED con `npx supabase test db --linked --debug`; esperado: función ausente.
3. Crear `supabase/migrations/20260927213000_create_payment_decision_rpc.sql`. La función debe:
   - usar `auth.uid()`/claim `sub` como actor;
   - bloquear fila del request;
   - verificar `payer_id = actor`;
   - validar versión y estado;
   - insertar `policy_decisions(source='manual')`;
   - actualizar status/version;
   - persistir/reusar idempotency key;
   - retornar `id,status,version,next_action`.
4. GREEN pgTAP.
5. Crear RED API en `backend/tests/api/test_payment_decisions_api.py` para:
   - `POST /payment-requests/{id}/approve`;
   - `POST /payment-requests/{id}/reject`;
   - body `{"expected_version": 1}`;
   - `Idempotency-Key` obligatorio;
   - `409` en stale version;
   - actor no se envía al RPC.
6. Crear:
   - `backend/src/patopay/api/schemas/payment_decisions.py`;
   - `backend/src/patopay/application/use_cases/payment_decisions.py`;
   - rutas en `backend/src/patopay/api/routes/payment_requests.py`.
7. GREEN backend completo.
8. Agregar RED frontend en `frontend/src/services/payments/payment.service.test.ts`; implementar métodos reales en:
   - `frontend/src/repositories/payment.repository.ts`;
   - `frontend/src/services/payments/payment.service.ts`;
   - `frontend/src/components/RealPaymentRequests.tsx`.
9. UI debe mostrar `Aprobada · todavía no pagada`; nunca éxito financiero.
10. GREEN frontend y commit: `feat: add versioned payment decisions`.

### Phase 7 — Persistencia de preparación x402 y estados de settlement

1. Crear RED pgTAP `supabase/tests/database/009_payment_settlement_state.test.sql` para:
   - estados de request `processing`, `paid`, `failed`;
   - columnas nuevas en `payment_attempts`;
   - una sola tentativa activa;
   - payload firmado no existe como columna;
   - RPCs de prepare/consume/record.
2. Crear migration `supabase/migrations/20260927214000_create_x402_settlement_rpcs.sql` que:
   - reemplace el check de `payment_requests.status` agregando `processing`, `paid`, `failed`;
   - agregue a `payment_attempts`:

   ```sql
   alter table patopay.payment_attempts
     add column if not exists payment_requirements jsonb,
     add column if not exists payment_payload_hash text,
     add column if not exists last_checked_at timestamptz;
   ```

   - agregue checks: requirements sólo en mode `stellar`; hash hex SHA-256; no signed payload;
   - cree RPCs `prepare_payment_attempt`, `consume_payment_attempt`, `record_payment_submission`, `record_payment_confirmation`, `record_payment_failure`, `record_payment_unknown`.

3. Contrato exacto de `prepare_payment_attempt`:

   ```text
   Inputs:
   p_request_id uuid
   p_expected_version integer
   p_attempt_id uuid
   p_payment_requirements jsonb
   p_preparation_expires_at timestamptz
   p_idempotency_key text

   Validaciones SQL:
   actor = payer_id
   request.status = approved
   request.version = expected_version
   source/destination wallets activas, stellar, testnet
   asset habilitado, testnet
   requirements.x402Version = 2
   accepted.scheme = exact
   accepted.network = stellar:testnet
   accepted.amount = request.amount_minor::text
   accepted.asset = asset.contract_address
   accepted.payTo = destination_wallet.contract_address
   expires_at entre now()+15s y now()+5m
   no intento activo distinto

   Efectos:
   inserta/reusa attempt prepared
   guarda requirements y digest(requirements::text, sha256)
   request pasa a processing una sola vez
   retorna intento + request + wallets + asset
   ```

4. `consume_payment_attempt` debe cambiar `prepared → submitting`, guardar sólo SHA-256 del payload, marcar `consumed_at` y rechazar un hash diferente en retry.
5. Los RPC `record_*` deben ser monotónicos, idempotentes y actualizar `payment_requests` sólo cuando corresponda:
   - confirmed → `paid`;
   - terminal failed sin otra tentativa posible → `failed`;
   - submitted/unknown → request sigue `processing`.
6. Ejecutar RED/GREEN pgTAP y commit: `feat: persist x402 settlement state machine`.

### Phase 8 — Modelos x402 y codec seguro en FastAPI

1. Crear RED en `backend/tests/unit/infrastructure/test_x402_codec.py`:
   - round-trip Base64 JSON UTF-8;
   - rechaza payload vacío, >100 KiB, Base64 inválido, JSON no objeto;
   - no modifica amount string;
   - `PaymentRequired` usa `x402Version=2`, `exact`, `stellar:testnet`.
2. Crear:
   - `backend/src/patopay/api/schemas/x402.py`;
   - `backend/src/patopay/infrastructure/x402/codec.py`;
   - `backend/src/patopay/infrastructure/x402/__init__.py`.
3. Modelos mínimos:

   ```py
   class X402Accepted(ApiModel):
       scheme: Literal["exact"] = "exact"
       network: Literal["stellar:testnet"] = "stellar:testnet"
       amount: str
       asset: str
       payTo: str
       maxTimeoutSeconds: int = Field(ge=15, le=300)
       extra: dict[str, object] = Field(default_factory=dict)

   class X402Resource(ApiModel):
       url: str
       description: str
       mimeType: Literal["application/json"] = "application/json"

   class X402PaymentRequired(ApiModel):
       x402Version: Literal[2] = 2
       error: str = "PAYMENT-SIGNATURE header is required"
       resource: X402Resource
       accepts: list[X402Accepted]
   ```

4. Usar serialización determinista para hashing: `model_dump_json(by_alias=True, exclude_none=True)` con separadores compactos o un helper único; tests fijan bytes exactos.
5. GREEN + backend gate + commit: `feat: add strict x402 v2 wire models`.

### Phase 9 — Puerto y adapter HTTP del facilitator x402

1. RED en `backend/tests/unit/infrastructure/test_x402_facilitator.py` con `httpx.MockTransport`:
   - `supported()` exige `stellar:testnet` + `exact`;
   - `verify()` envía payload/requirements exactos;
   - `settle()` parsea `success`, `transaction`, `network`, `payer`, `errorReason`;
   - timeout se convierte en error ambiguo, no en rechazo terminal;
   - respuestas malformed fallan cerradas;
   - no loguea `PAYMENT-SIGNATURE`.
2. Crear `backend/src/patopay/application/ports/x402.py`:

   ```py
   class X402Facilitator(Protocol):
       async def supported(self) -> bool: ...
       async def verify(self, *, payment_payload: dict[str, object], requirements: dict[str, object]) -> VerificationResult: ...
       async def settle(self, *, payment_payload: dict[str, object], requirements: dict[str, object]) -> SettlementResult: ...
   ```

3. Crear `backend/src/patopay/infrastructure/x402/client.py` usando el `httpx.AsyncClient` inyectable y endpoints `/supported`, `/verify`, `/settle` según spec v2.
4. Ampliar `backend/src/patopay/config.py`:

   ```py
   x402_enabled: bool = False
   x402_facilitator_url: HttpUrl | None = None
   x402_timeout_seconds: float = Field(default=20.0, gt=0, le=60)
   x402_max_timeout_seconds: int = Field(default=60, ge=15, le=300)
   ```

   Validar que `payment_executor='stellar'` exige `x402_enabled`, facilitator URL, Stellar RPC y contract ID. En production no proporcionar URL pública por default.
5. Inyectar adapter en `backend/src/patopay/main.py` mediante parámetro explícito `x402_facilitator`; conservar fail-fast.
6. GREEN + full gate + commit: `feat: add x402 facilitator adapter`.

### Phase 10 — Endpoint x402 `settle` con 402 real

1. Crear RED API en `backend/tests/api/test_x402_settlement_api.py` para el primer request sin firma:
   - JWT e `Idempotency-Key` obligatorios;
   - body `{"expected_version": 2, "attempt_id": null}`;
   - status `402`;
   - header `PAYMENT-REQUIRED` decodifica a x402 v2 exact;
   - amount, asset y payTo vienen de datos canónicos, no del cliente;
   - body contiene `attempt_id`, `expires_at`, `status=prepared`, `next_action=sign_x402`.
2. Implementar mínimo en:
   - `backend/src/patopay/api/schemas/settlements.py`;
   - `backend/src/patopay/application/use_cases/settlements.py`;
   - `backend/src/patopay/api/routes/settlements.py`;
   - registrar router en `backend/src/patopay/main.py`.
3. GREEN focused test.
4. Segundo RED: retry sin firma y mismo attempt/idempotency devuelve exactamente las mismas requirements; key distinta no crea segundo intento activo.
5. Implementar idempotencia y GREEN.
6. Tercer RED, request con `PAYMENT-SIGNATURE`:
   - `attempt_id` obligatorio;
   - decodifica payload;
   - verifica accepted scheme/network/amount/asset/payTo contra requirements persistidas;
   - consume intento antes de llamar facilitator;
   - llama `verify` y sólo después `settle`;
   - settlement exitoso retorna `200`, `status=paid`, `txHash` real y `PAYMENT-RESPONSE`;
   - verify inválido retorna `402`, intento failed, sin llamar settle;
   - timeout retorna `202`, status `unknown`, sin inventar hash;
   - segundo payload distinto sobre intento consumido retorna `409`.
7. Implementar mínimo y GREEN.
8. Cuarto RED: el servicio nunca pasa `PAYMENT-SIGNATURE` al gateway Supabase ni lo persiste; sólo hash SHA-256.
9. GREEN, refactor y backend completo.
10. Commit: `feat: settle payment requests through x402`.

### Phase 11 — Historial de intentos y reconciliación

1. RED API para `GET /payment-requests/{id}/attempts`; sólo payer/requester ve intentos y respuesta excluye requirements completas, payload hash y receipt crudo.
2. Crear `PaymentAttemptResponse` con:

   ```py
   id: UUID
   payment_request_id: UUID
   attempt_number: int
   mode: Literal["stellar"]
   status: Literal["prepared","submitting","submitted","confirmed","failed","unknown"]
   tx_hash: str | None
   ledger: int | None
   error_code: str | None
   created_at: datetime
   updated_at: datetime
   ```

3. GREEN y commit pequeño.
4. RED unitario para `backend/src/patopay/infrastructure/stellar/rpc.py`:
   - `getTransaction` success/failed/not_found;
   - valida hash de 64 hex;
   - timeout es ambiguous;
   - valida network passphrase/config.
5. Implementar cliente JSON-RPC con `httpx`; no agregar SDK si la respuesta necesaria puede validarse sin XDR. Si hay que validar eventos SAC, agregar `stellar-sdk` con `uv add stellar-sdk`, fijar lock y cubrir parsing con fixtures reales anonimizados.
6. RED API para `POST /payment-attempts/{id}/refresh`:
   - confirmed sólo si transaction hash existe, RPC dice success y receipt/operación coincide con requirements;
   - failed sólo ante fallo on-chain inequívoco;
   - pending/not_found antes de expiry conserva submitted/unknown;
   - not_found después de expiry sin evidencia no habilita retry automático: conserva `unknown` y devuelve `manual_review`;
   - idempotente.
7. Implementar y GREEN.
8. Commit: `feat: reconcile stellar payment attempts`.

### Phase 12 — Balance USDC y verificación de smart wallet en backend

1. RED unitario `backend/tests/unit/infrastructure/test_stellar_wallet_reader.py`:
   - lee `balance(wallet)` del SAC configurado;
   - convierte sólo i128/base units a string;
   - devuelve ledger/observed_at;
   - rechaza contract ID distinto o RPC malformed.
2. Crear puerto `backend/src/patopay/application/ports/stellar.py` y adapter `backend/src/patopay/infrastructure/stellar/wallet_reader.py`.
3. Inyectar reader en `create_app`; si falta y wallet es Stellar, mantener `503`, nunca `0` falso.
4. GREEN unitario.
5. RED API en `backend/tests/api/test_wallet_api.py` para balance real con reader fake y `POST /me/wallets/{id}/verify`.
6. La verificación debe comprobar:
   - contract existe en Testnet;
   - WASM hash pertenece a allowlist configurada;
   - `creation_tx_hash` existe y fue exitoso;
   - address y hash coinciden;
   - sólo entonces RPC Supabase cambia `unverified → active` con versioning.
7. Crear migration/RPC `verify_stellar_wallet` y pgTAP correspondiente; no permitir al cliente activar mediante PATCH directo.
8. GREEN backend + pgTAP.
9. Commit: `feat: verify stellar wallets and read USDC balances`.

### Phase 13 — Endurecer y desplegar el relayer de smart-wallet

1. Refactorizar `supabase/functions/stellar-relayer/index.ts` para exportar `handler(request, deps)` y dejar `Deno.serve(handler)` al final; esto permite tests sin red.
2. RED en `supabase/functions/stellar-relayer/index_test.ts`:
   - método no POST → 405;
   - network no Testnet → 400;
   - XDR >100 KiB → 400;
   - más de una operación → 400;
   - operación no Soroban → 400;
   - ausencia de relayer config → 503;
   - éxito devuelve hash/ledger/transactionId;
   - nunca devuelve API key.
3. En `supabase/config.toml` agregar:

   ```toml
   [functions.stellar-relayer]
   verify_jwt = true
   ```

4. Cambiar CORS para fallar cerrado si `PATOPAY_ALLOWED_ORIGINS` está vacío en entorno remoto. No usar `*` para requests con Authorization.
5. Nombrar explícitamente la función como relayer de operaciones de wallet, no como executor de PaymentRequests. Las transferencias x402 deben ir al facilitator.
6. Ejecutar:

   ```bash
   deno test supabase/functions/stellar-relayer/index_test.ts
   git diff --check
   ```

7. Commit: `fix: harden smart wallet relayer boundary`.
8. Despliegue remoto sólo después de Phase 16:

   ```bash
   npx supabase functions deploy stellar-relayer --project-ref ekgfskibieqljhazchno
   ```

9. Verificar externamente:
   - sin JWT → 401;
   - JWT + payload inválido → 400;
   - function list muestra `stellar-relayer` ACTIVE.

### Phase 14 — Policy Soroban compartida y configurable

#### 14.1 Workspace y ABI fijada

1. Crear:
   - `contracts/Cargo.toml`;
   - `contracts/Cargo.lock`;
   - `contracts/patopay-policy/Cargo.toml`;
   - `contracts/patopay-policy/src/lib.rs`;
   - `contracts/patopay-policy/src/test.rs`.
2. Pin de ABI exacto en `contracts/patopay-policy/Cargo.toml`:

   ```toml
   [dependencies]
   soroban-sdk = "=23.5.3"
   smart-wallet-interface = { git = "https://github.com/stellar/passkey-kit.git", rev = "4e24eb1005d893dab1cf3dab08ba49f2c3df7069", package = "smart-wallet-interface" }
   ```

   Antes de fijar `soroban-sdk`, comparar con el `Cargo.lock` de tag v0.19.1 y usar exactamente la misma versión; no mezclar Protocol/SDK.

#### 14.2 Tests RED del contrato

3. Escribir un test por comportamiento y ejecutar cada uno antes de implementar:

   ```bash
   cd contracts
   cargo test -p patopay-policy test_install_requires_wallet_auth
   cargo test -p patopay-policy test_rejects_non_usdc_contract
   cargo test -p patopay-policy test_rejects_wrong_from
   cargo test -p patopay-policy test_rejects_unlisted_recipient
   cargo test -p patopay-policy test_rejects_amount_above_auto_limit
   cargo test -p patopay-policy test_rejects_cumulative_daily_limit
   cargo test -p patopay-policy test_resets_window_after_24_hours
   cargo test -p patopay-policy test_rejects_stale_revision
   cargo test -p patopay-policy test_uninstall_refuses_while_attached
   ```

4. Modelo on-chain:

   ```rust
   #[contracttype]
   pub struct PolicyConfig {
       pub asset: Address,
       pub auto_pay_limit: i128,
       pub daily_limit: i128,
       pub allowed_recipients: Vec<Address>,
       pub revision: u64,
   }

   #[contracttype]
   pub struct Allowance {
       pub window_start: u64,
       pub spent: i128,
   }
   ```

5. Implementar `PolicyInterface` siguiendo el sample-policy fijado:
   - `install(wallet)` autentica wallet y crea marcador, pero queda `configured=false`;
   - `configure(wallet, config)` exige `wallet.require_auth()`, límites positivos, `auto <= daily`, revisión estrictamente creciente y lista acotada;
   - `policy__` llama `source.require_auth()` antes de mutar gasto;
   - sólo acepta `Context::Contract` contra `config.asset`, función `transfer`;
   - parsea args `from`, `to`, `amount` y exige `from == source`;
   - rechaza amount <= 0, amount > auto, destinatario fuera de allowlist y acumulado > daily;
   - suma todas las transferencias del context con `checked_add`;
   - renueva TTL de instancia/config/spend;
   - `uninstall` verifica con `SmartWalletClient.get_signer` que la policy ya no está adjunta.

6. No introducir un per-transfer cap sin acumulado: una `PolicySigner` no tiene secreto y podría ser invocada repetidamente.
7. GREEN completo:

   ```bash
   cargo fmt --all --check
   cargo clippy --workspace --all-targets -- -D warnings
   cargo test --workspace
   cargo build --target wasm32v1-none --release -p patopay-policy
   ```

8. Commit: `feat: add bounded Stellar payment policy contract`.

#### 14.3 Deploy único de Testnet

9. Instalar/fijar Stellar CLI si faltaba; no generar ni imprimir secrets en chat.
10. Crear identidad local del deployer en el keychain de Stellar CLI y fondearla con Friendbot. No commitear archivos de identidad.
11. Construir y optimizar WASM:

    ```bash
    stellar contract optimize \
      --wasm contracts/target/wasm32v1-none/release/patopay_policy.wasm
    sha256sum contracts/target/wasm32v1-none/release/patopay_policy.optimized.wasm
    ```

12. Desplegar una sola instancia compartida en Testnet; guardar sólo contract ID y WASM hash públicos en configuración/documentación. Verificar con `stellar contract inspect` y RPC.

### Phase 15 — Adjuntar/configurar policy al smart wallet

1. RED frontend `frontend/src/services/wallet/stellar-policy.service.test.ts`:
   - construye `kit.addPolicy(policyAddress, limits, SignerStore.Persistent)`;
   - firma con passkey;
   - envía por wallet relayer;
   - configura policy con asset/límites/recipients/revision;
   - actualiza límites de la passkey para:

   ```text
   wallet contract → admin permitido
   policy contract → configure permitido
   USDC SAC → exige Policy(policy contract)
   todo lo demás → denegado
   ```

2. Crear `frontend/src/services/wallet/stellar-policy.service.ts`. Usar `SignerKey.Policy`, `SignerStore.Persistent` y un `Map` de límites; no instalar policy como signer ilimitado.
3. Agregar métodos al backend:
   - schema `OnChainPolicyActivation` con contract address, revision, attach/config tx hashes;
   - `POST /api/v1/me/payment-policy/on-chain/activate`;
   - RPC Supabase que sólo actualiza la versión latest del actor y exige revisión creciente.
4. RED/GREEN backend y pgTAP para activación.
5. Integrar onboarding en `frontend/app/onboarding/policy.tsx` y `frontend/app/onboarding/complete.tsx`:
   - no mostrar “Policy activa” hasta que attach/config estén confirmados;
   - si falla, wallet/passkey pueden quedar activas pero policy figura pendiente;
   - reintentar idempotentemente.
6. Ejecutar frontend/backend gates.
7. Commit: `feat: enforce payment policy in smart wallet`.

### Phase 16 — Cliente x402 móvil y cutover del pago real

1. Refactor RED para conservar respuestas 402 y headers en `frontend/src/services/api/patopayApi.test.ts`.
2. Extraer en `frontend/src/services/api/patopayApi.ts`:

   ```ts
   export async function apiResponse(path:string,init:RequestInit={}):Promise<Response>
   ```

   Debe conservar refresh JWT, timeout y aislamiento de usuario; `apiRequest<T>` pasa a envolver `apiResponse` para el comportamiento existente. Para 402, `apiResponse` no lanza antes de que x402 lea `PAYMENT-REQUIRED`.
3. GREEN API client.
4. Crear RED `frontend/src/services/x402/patopay-x402.client.test.ts`:
   - primera llamada recibe 402;
   - decodifica `PAYMENT-REQUIRED`;
   - valida request ID, USDC SAC, amount, payTo, network y expiry contra PaymentRequest mostrado;
   - pide firma local exactamente una vez;
   - reintenta con `PAYMENT-SIGNATURE` y mismo `Idempotency-Key`/attempt;
   - parsea `PAYMENT-RESPONSE`;
   - no persiste header firmado;
   - abort/cancel no llama segunda vez;
   - 202 unknown no muestra éxito.
5. Implementar con `x402Client` + `ExactStellarScheme(getConnectedPasskeySigner())`. No usar `createEd25519Signer`.
6. Reemplazar el flujo real manual de `frontend/app/payment/send.tsx`:
   - recibe `paymentRequestId`, no destination/amount editables;
   - carga request desde FastAPI;
   - exige status `approved`;
   - muestra destinatario y monto read-only;
   - llama cliente x402;
   - éxito sólo con `paid/confirmed`;
   - submitted/unknown navega a pantalla de seguimiento, no success.
7. Mantener `frontend/src/services/demo/demo-payment.service.ts` únicamente para `DEMO_MODE=true`; ningún hash demo se muestra como Stellar.
8. Actualizar:
   - `frontend/src/services/api/types.ts`;
   - `frontend/src/types/domain.ts`;
   - `frontend/src/components/RealPaymentRequests.tsx`;
   - `frontend/app/payment/success.tsx`;
   - `frontend/app/(tabs)/activity.tsx`.
9. GREEN:

   ```bash
   npm run typecheck
   npm run lint
   npm run test:all
   ```

10. Commit: `feat: complete passkey x402 payment flow`.

### Phase 17 — Configuración y despliegue remoto controlado

No ejecutar esta fase hasta que todas las suites offline estén verdes y el diff haya sido revisado.

1. Actualizar sólo ejemplos/documentación:
   - `backend/.env.example`;
   - `frontend/.env.example`;
   - `supabase/functions/.env.example`.
2. Variables públicas frontend:

   ```text
   EXPO_PUBLIC_DEMO_MODE=false
   EXPO_PUBLIC_STELLAR_NETWORK=testnet
   EXPO_PUBLIC_STELLAR_RELAYER_URL=<Edge Function HTTPS>
   EXPO_PUBLIC_STELLAR_ASSET_CODE=USDC
   EXPO_PUBLIC_STELLAR_ASSET_CONTRACT_ID=CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA
   EXPO_PUBLIC_STELLAR_ASSET_DECIMALS=7
   EXPO_PUBLIC_PASSKEY_RP_ID=<dominio real>
   EXPO_PUBLIC_PASSKEY_ALLOWED_ORIGINS=<origins reales>
   EXPO_PUBLIC_PATOPAY_POLICY_CONTRACT_ID=<C… desplegado>
   ```

3. Variables backend:

   ```text
   PATOPAY_PAYMENT_EXECUTOR=stellar
   PATOPAY_STELLAR_NETWORK=testnet
   PATOPAY_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
   PATOPAY_STELLAR_ASSET_CONTRACT_ID=CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA
   PATOPAY_STELLAR_ASSET_CODE=USDC
   PATOPAY_STELLAR_ASSET_SCALE=7
   PATOPAY_X402_ENABLED=true
   PATOPAY_X402_FACILITATOR_URL=<facilitator que reporte stellar:testnet>
   ```

4. Secrets de Edge Function se cargan desde prompt/archivo local ignorado; nunca por chat ni commit:

   ```text
   STELLAR_RELAYER_BASE_URL
   STELLAR_RELAYER_API_KEY
   PATOPAY_ALLOWED_ORIGINS
   ```

5. Verificar facilitator antes de configurar:

   ```bash
   curl -fsS <FACILITATOR_URL>/supported
   ```

   Esperado: `stellar:testnet`, scheme `exact`. No avanzar si no aparece.

6. Revisar migrations:

   ```bash
   npx supabase migration list --linked
   npx supabase db push --linked --dry-run --skip-vault
   ```

   Esperado: sólo migrations nuevas de este plan. Revisar SQL exacto antes de aplicar.

7. Aplicar migrations después de aprobación explícita:

   ```bash
   npx supabase db push --linked --skip-vault
   npx supabase test db --linked --debug
   ```

8. Read-back remoto:
   - assets contiene exactamente USDC esperado;
   - RPCs existen;
   - RLS sigue enabled/forced;
   - `anon` sigue sin permisos;
   - no hay columnas de signed payload/private material.
9. Desplegar Edge Function y read-back con `list_edge_functions`.
10. Configurar `.env`/`.env.local` locales sin imprimir valores; no commitearlos.
11. Commit sólo ejemplos/docs/config no secretos: `docs: document Stellar x402 deployment`.

### Phase 18 — Smoke E2E verificable en Testnet

Usar dos usuarios de prueba y montos mínimos. No ejecutar con fondos reales/mainnet.

1. Development Build, no Expo Go:

   ```bash
   cd frontend
   npx expo run:android
   # o npx expo run:ios
   ```

2. Usuario A y B completan Auth y perfiles.
3. Crear smart wallet con passkey para ambos; registrar en FastAPI.
4. Verificar cada wallet:
   - contract `C…`;
   - `creationTxHash` abre en explorer Testnet;
   - backend status `active`.
5. Fondear XLM sólo para setup cuando sea necesario y obtener USDC Testnet desde faucet oficial; verificar balance USDC por backend.
6. Adjuntar/configurar policy de B; comprobar revision y tx hashes.
7. A crea PaymentRequest a B por una unidad pequeña dentro de policy.
8. B aprueba; confirmar UI `approved · todavía no pagada`.
9. B inicia settle:
   - backend devuelve 402 y `PAYMENT-REQUIRED`;
   - passkey prompt local;
   - frontend manda `PAYMENT-SIGNATURE`;
   - facilitator settle;
   - backend reconcilia.
10. Verificar con tres fuentes:
    - explorer/RPC: tx success y transferencia USDC exacta;
    - Supabase: attempt `confirmed`, tx_hash/ledger/receipt sanitizado;
    - FastAPI/UI: request `paid` y mismo txHash.
11. Prueba negativa sobre auto limit: policy on-chain debe rechazar; no cambia balance; attempt failed con código seguro.
12. Prueba negativa destinatario no permitido: mismo resultado.
13. Reenviar mismo payload/idempotency key: no segunda transferencia.
14. Simular timeout del cliente tras submit: request queda `processing/unknown`; `refresh` reconcilia sin duplicar.
15. Guardar como evidencia sólo IDs/hashes públicos y outputs sanitizados en `docs/testnet-smoke.md`; ninguna credencial ni payload firmado.
16. Commit: `test: record verified Testnet settlement`.

### Phase 19 — Limpieza, documentación y eliminación de caminos engañosos

1. Buscar y clasificar:

   ```bash
   rg -n -i 'mock|TODO|FIXME|signedXdr|private.?key|seed|XLM|approved.*paid|x402' backend frontend supabase docs
   ```

2. Eliminar:
   - flujo real manual con destination/amount arbitrario;
   - helpers sin consumidores;
   - fallback silencioso a XLM;
   - documentación que diga que x402/Stellar funcionan sin condición;
   - broad exceptions introducidas durante implementación;
   - logs de JWT, payload x402 o XDR.
3. Mantener demo aislada y etiquetada; hashes demo nunca deben parecer hashes de 64 hex o links al explorer.
4. Actualizar:
   - `backend/README.md`;
   - `frontend/README.md`;
   - `frontend/BACKEND_INTEGRATION.md`;
   - `docs/api-integration.md`;
   - `docs/patopay-api-reference.html` regenerado desde OpenAPI;
   - `docs/patopay-architecture-current.html`.
5. Documentar exactamente:
   - passkey local;
   - policy off-chain vs on-chain;
   - wallet relayer vs x402 facilitator;
   - states y semántica de unknown;
   - Testnet solamente;
   - `approved != paid`.
6. Commit: `docs: describe verified Stellar x402 settlement`.

---

## Tests / validation

### TDD por cada slice

Para cada función/ruta/RPC/contrato:

1. agregar un único test focalizado;
2. ejecutar el nodo exacto y observar RED por comportamiento faltante;
3. implementar mínimo;
4. ejecutar el nodo exacto y observar GREEN;
5. ejecutar suite del componente;
6. refactorizar sólo en verde;
7. commit pequeño.

Ejemplos:

```bash
# Backend RED/GREEN focalizado
cd backend
uv run pytest tests/api/test_x402_settlement_api.py::test_unsigned_settle_returns_x402_requirements -vv

# Frontend RED/GREEN focalizado
cd frontend
npm run test:unit -- x402-passkey-signer.test.ts

# Contrato RED/GREEN focalizado
cd contracts
cargo test -p patopay-policy test_rejects_cumulative_daily_limit -- --nocapture

# Base de datos
npx supabase test db --linked --debug
```

### Quality gate backend

```bash
cd backend
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
uv run mypy src
```

Esperado: todos PASS, sin warnings nuevos.

### Quality gate frontend

```bash
cd frontend
npm ci
npm run typecheck
npm run lint
npm run test:all
```

Esperado: TypeScript PASS, ESLint 0 errores; warnings existentes deben reducirse o quedar documentados, nunca aumentar.

### Quality gate contratos

```bash
cd contracts
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo build --target wasm32v1-none --release -p patopay-policy
```

### Quality gate Supabase

```bash
npx supabase db push --linked --dry-run --skip-vault
npx supabase test db --linked --debug
npx supabase functions serve stellar-relayer --env-file supabase/functions/.env.local
```

Esperado: migrations exactas, pgTAP PASS, function tests PASS. `.env.local` debe estar ignorado.

### Security assertions obligatorias

- No aparecen private keys, seeds, WebAuthn private material, relayer API keys, `service_role`, passwords, JWT secrets ni signed XDR en `git diff`.
- `PAYMENT-SIGNATURE` se mantiene en memoria sólo durante request y se persiste únicamente como SHA-256.
- El backend nunca acepta amount/asset/payTo desde el segundo request para redefinir la intención.
- El facilitator verifica igualdad exacta de asset, amount y payTo.
- Policy on-chain valida `contract`, `fn_name`, `from`, `to`, amount y gasto acumulado.
- El relayer sólo transmite autorizaciones firmadas; no tiene autoridad sobre fondos.
- Un mock nunca produce `paid`, txHash realista ni explorer URL.
- `unknown` bloquea retry automático.

### Final repository gate

```bash
cd /home/jhaycortez/code/f-projects/f-pato_pay
git diff --check
git status --short --branch
git log --oneline --decorate origin/main..HEAD
```

Esperado: sólo artefactos intencionales; `.env*`, credenciales, WASM build output y `node_modules` fuera de commits.

## Acceptance criteria

- [ ] Frontend typecheck, lint y tests pasan.
- [ ] Backend tests, Ruff, format y mypy pasan.
- [ ] pgTAP pasa con migrations nuevas.
- [ ] Contrato Soroban compila y sus tests negativos/positivos pasan.
- [ ] Supabase Cloud contiene USDC Testnet canónico y no da permisos a `anon`.
- [ ] Edge Function del wallet relayer está desplegada, exige JWT y responde correctamente a payload inválido.
- [ ] Dos smart wallets Testnet fueron creadas y verificadas con tx hashes públicos.
- [ ] La passkey firma localmente; no existe seed en frontend/backend.
- [ ] La policy on-chain está adjunta y restringe USDC.
- [ ] Un PaymentRequest approved se liquida por x402 exact y termina paid sólo tras confirmación.
- [ ] El `txHash`, ledger, asset, amount, payer y payTo coinciden entre facilitator, RPC/explorer y backend.
- [ ] Over-limit, recipient inválido y replay son rechazados sin segundo movimiento.
- [ ] Timeout ambiguo produce `unknown` y se reconcilia sin retry ciego.
- [ ] Documentación y diagrama reflejan exactamente el estado probado.

## Risks, tradeoffs, and open questions

### Blockers que deben resolverse antes del E2E

1. **Dominio real para passkeys:** `RP_ID` no puede ser inventado. Expo Development Build debe asociarse correctamente con Android/iOS y el origen permitido por `react-native-passkey`.
2. **Facilitator Testnet:** comprobar que el endpoint elegido anuncia `stellar:testnet`, scheme exact y el SAC USDC esperado. El facilitator público es para desarrollo, no producción.
3. **Compatibilidad smart wallet:** aunque `@x402/stellar` expone `ClientStellarSigner` para `C…`, el test de Phase 3 debe demostrar que el XDR/auth entry generado por `passkey-kit` es aceptado por el facilitator real.
4. **Versiones Protocol 27/28:** `passkey-kit`, Stellar SDK, wallet WASM y Soroban contract SDK deben estar alineados. No actualizar uno aisladamente.
5. **Software no auditado:** `passkey-kit` y una policy propia implican riesgo. Mantener balances mínimos de Testnet y no presentar readiness de producción.
6. **USDC faucet/trustline:** para classic accounts puede requerirse trustline; la smart wallet/SAC debe probarse con el contract SEP-41 concreto.

### Tradeoffs deliberados

- Se usa una policy compartida configurable por wallet para evitar desplegar una instancia por usuario. Reduce costo/operación, pero concentra upgrades y exige aislamiento de claves de storage por wallet.
- La policy exige passkey + policy para cada transferencia; esto da enforcement on-chain, pero no pago desatendido. Una futura agent/session key es otra fase de seguridad, no un atajo de este MVP.
- El signed payload no se persiste. Mejora seguridad; a cambio, un timeout sin txHash puede quedar `unknown/manual_review`.
- El frontend deja de aceptar destination/amount manuales en modo real. Reduce flexibilidad, pero garantiza que lo firmado coincide con el PaymentRequest.
- El facilitator x402 realiza verify/settle y el relayer de passkey-kit queda para lifecycle de wallet. Unificarlos sería menos infraestructura, pero mezclaría protocolos y debilitaría validaciones.

### Preguntas abiertas no bloqueantes para código offline

1. ¿Cuál será el dominio definitivo de `EXPO_PUBLIC_PASSKEY_RP_ID` y qué Associated Domains/App Links se configurarán para Android/iOS?
2. ¿Qué facilitator Stellar Testnet se usará finalmente: x402.org, Built on Stellar u otro? Elegir por `/supported`, límites, disponibilidad y terms, no por nombre.
3. ¿La allowlist on-chain debe almacenar todas las wallets destino o inicialmente sólo permitir cualquier destinatario y usar únicamente límites? Recomendación segura: allowlist cuando `recipient_mode=allowlist`; lista vacía bloquea todo.
4. ¿Cuánto dura la ventana diaria: rolling 24h desde primer gasto o día UTC? Este plan usa rolling 24h porque evita reset coordinado y sigue el patrón seguro del sample-policy.
5. ¿Se requiere pago autónomo sin prompt en esta entrega? Recomendación: no. Si la respuesta es sí, abrir un plan separado para agent/session keys con expiry, revoke y límites on-chain; nunca reutilizar la passkey o almacenar una seed en FastAPI.
6. ¿Quién opera el deployer/upgrade authority del contrato policy? Para Testnet puede ser una identidad local; producción requiere multisig, proceso de upgrades y auditoría.

## Suggested commit sequence

```text
fix: type auth navigation segments
test: establish x402 stellar client harness
feat: adapt passkey wallet to x402 stellar signer
feat: expose canonical testnet USDC asset
feat: resolve USDC asset through FastAPI
feat: add versioned payment decisions
feat: persist x402 settlement state machine
feat: add strict x402 v2 wire models
feat: add x402 facilitator adapter
feat: settle payment requests through x402
feat: reconcile stellar payment attempts
feat: verify stellar wallets and read USDC balances
fix: harden smart wallet relayer boundary
feat: add bounded Stellar payment policy contract
feat: enforce payment policy in smart wallet
feat: complete passkey x402 payment flow
docs: document Stellar x402 deployment
test: record verified Testnet settlement
docs: describe verified Stellar x402 settlement
```
