# Pato Pay + Stellar Testnet

La wallet principal de Pato Pay usa una smart wallet Soroban controlada por una
passkey. No se genera ni se persiste una secret key de Stellar.

```text
Acceso a la app                         Autorización blockchain
Face ID / Touch ID / device auth        Passkey del dispositivo
                ↓                                   ↓
           Pato Pay UI                    Smart wallet Soroban (C…)
                                                    ↓
                                            Stellar Testnet
```

`expo-local-authentication` aparece solamente en `src/services/security`.
El firmante blockchain es WebAuthn/passkey mediante `react-native-passkey` y
`passkey-kit`.

## Qué es real

- El onboarding registra una passkey del dispositivo.
- `passkey-kit` construye y firma el despliegue de una smart wallet real.
- Un Edge Function autenticado entrega el XDR firmado al relayer de Testnet.
- La dirección devuelta es un contract ID Stellar real (`C…`).
- El balance se consulta en Stellar RPC mediante el contrato SAC del activo.
- Friendbot fondea la dirección en Testnet desde la pantalla **Cargar saldo**.
- Los pagos construyen una transferencia SAC, solicitan la passkey, envían el
  XDR firmado y muestran el `txHash` real en Stellar Expert.

El modo `mock` sigue disponible sólo con `EXPO_PUBLIC_WALLET_MODE=mock`. La UI lo
rotula como mock y no afirma que haya creado una passkey o transacción real.

## Datos persistidos

En AsyncStorage se guardan solamente metadatos públicos:

- dirección `C…`;
- credential ID y clave pública WebAuthn;
- red, estado, hash de creación y metadatos públicos de asociación.

No se guardan secret keys, seeds ni private keys en el dispositivo, Supabase o
el backend. Supabase Auth sí persiste una sesión de aplicación de corta duración
para proteger el Edge Function; esa sesión no controla ni firma la wallet.

## Requisitos

- Node.js 22.13 o superior. El proyecto fija 22.19 en `.nvmrc`.
- Android o iOS con passkeys habilitadas.
- Development Build. Expo Go no contiene los módulos nativos de passkeys y
  crypto requeridos por el modo Stellar.
- Un dominio HTTPS para WebAuthn.
- Un canal/relayer de OpenZeppelin para Stellar Testnet.
- Proyecto Supabase con anonymous sign-ins habilitado.

## Variables del frontend

Completá el `.env` existente tomando `.env.example` como referencia (si no
existe, recién ahí copialo) con:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://ekgfskibieqljhazchno.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...

EXPO_PUBLIC_WALLET_MODE=stellar
EXPO_PUBLIC_STELLAR_NETWORK=testnet
EXPO_PUBLIC_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
EXPO_PUBLIC_STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
EXPO_PUBLIC_STELLAR_FRIENDBOT_URL=https://friendbot.stellar.org
EXPO_PUBLIC_STELLAR_EXPLORER_URL=https://stellar.expert/explorer/testnet
EXPO_PUBLIC_STELLAR_WALLET_WASM_HASH=97ce047884106b1c6c3bb40b8973cc48db1c4dad95c9e20462bf2c701daa764e
EXPO_PUBLIC_STELLAR_RELAYER_URL=https://ekgfskibieqljhazchno.supabase.co/functions/v1/stellar-relayer

EXPO_PUBLIC_PASSKEY_RP_ID=wallet.tudominio.com
EXPO_PUBLIC_PASSKEY_ALLOWED_ORIGINS=https://wallet.tudominio.com,android:apk-key-hash:HASH_BASE64URL

EXPO_PUBLIC_STELLAR_ASSET_CODE=XLM
EXPO_PUBLIC_STELLAR_ASSET_CONTRACT_ID=
EXPO_PUBLIC_STELLAR_ASSET_DECIMALS=7
```

Si `EXPO_PUBLIC_STELLAR_ASSET_CONTRACT_ID` queda vacío, se usa el SAC nativo de
XLM Testnet. Para probar un USDC de Testnet hay que indicar el contract ID real
de ese activo; cambiar solamente el texto a `USDC` no crea un activo.

## Asociar el dominio de la passkey

El RP ID debe ser un dominio real controlado por el proyecto, sin esquema ni
ruta. El bundle/package configurado es `com.patopay.mobile`.

En `https://wallet.tudominio.com/.well-known/apple-app-site-association`:

```json
{
  "applinks": {},
  "webcredentials": {
    "apps": ["APPLE_TEAM_ID.com.patopay.mobile"]
  },
  "appclips": {}
}
```

En `https://wallet.tudominio.com/.well-known/assetlinks.json`:

```json
[
  {
    "relation": ["delegate_permission/common.get_login_creds"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.patopay.mobile",
      "sha256_cert_fingerprints": ["AA:BB:CC:..."]
    }
  }
]
```

El origen Android de `EXPO_PUBLIC_PASSKEY_ALLOWED_ORIGINS` usa el SHA-256 del
certificado convertido a base64url, con el prefijo
`android:apk-key-hash:`. Debe corresponder al certificado con el que se instaló
el Development Build.

## Configurar el relayer en Supabase

Desde la raíz del repositorio:

```bash
nvm use
npx supabase login
npx supabase link --project-ref ekgfskibieqljhazchno
cp supabase/functions/.env.example supabase/functions/.env
```

Editá `supabase/functions/.env` y completá la API key real del relayer:

```dotenv
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_RELAYER_BASE_URL=https://channels.openzeppelin.com/testnet
STELLAR_RELAYER_API_KEY=REEMPLAZAR
PATOPAY_ALLOWED_ORIGINS=https://wallet.tudominio.com
```

Luego:

```bash
npx supabase config push
npx supabase secrets set --env-file supabase/functions/.env
npx supabase functions deploy stellar-relayer
npx supabase secrets list
```

`config push` aplica `enable_anonymous_sign_ins = true` y mantiene
`verify_jwt = true` para `stellar-relayer`. Conviene revisar cualquier otro
cambio del `config.toml` antes de aplicarlo a un proyecto con usuarios reales.
La API key del relayer nunca debe usar el prefijo `EXPO_PUBLIC_`.

## Instalar y ejecutar

Desde `frontend/`:

```bash
nvm use
npm install
npm run typecheck
npx expo prebuild
npm run android:dev
```

En macOS, para iOS:

```bash
nvm use
npm install
npx expo prebuild
npm run ios:dev
```

Una vez instalado el Development Build, Metro puede exponerse al teléfono con:

```bash
npx expo start --dev-client --tunnel
```

El teléfono puede usar directamente Stellar, Supabase y el relayer por HTTPS;
no necesita que FastAPI esté levantado en la computadora.

Para trabajar sólo la UI en Expo Go:

```bash
EXPO_PUBLIC_WALLET_MODE=mock npx expo start --tunnel
```

## Prueba manual end-to-end

1. Abrir el Development Build y completar el onboarding.
2. Tocar **Crear wallet** y aceptar la passkey del sistema.
3. Verificar la dirección real `C…` y el hash de despliegue.
4. Ir a **Cargar saldo** y tocar **Fondear en Testnet**.
5. Volver al inicio y confirmar el balance consultado en cadena.
6. Tocar **Enviar**, ingresar una dirección Stellar Testnet y un monto.
7. Tocar **Aprobar y pagar**, aceptar la passkey y abrir el explorer desde la
   pantalla de éxito.

Testnet se reinicia periódicamente. Sus activos no tienen valor y no deben
usarse como si fueran fondos reales.
