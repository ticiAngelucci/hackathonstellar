# Pato Pay: demo para el pitch

Activar en `.env`:

```env
EXPO_PUBLIC_DEMO_MODE=true
```

Reiniciar Expo con `npx expo start --clear`. No hacen falta credenciales de Supabase,
Stellar, passkeys ni biometría. El botón **⋯** abre **Opciones** desde las
pantallas, incluido el onboarding. Para volver a las integraciones existentes,
usá `EXPO_PUBLIC_DEMO_MODE=false` y reiniciá Expo. El modo real usa Stellar; el servicio mock antiguo queda reservado para pruebas aisladas.

## Reset

⋯ → Empezar de nuevo. Borra exclusivamente claves `patopay:demo:v1:*`, restaura
52.30 USDC, grupos, solicitudes, actividad, servicios, staking y reglas, y vuelve
al onboarding. No borra cuentas, passkeys, bloqueo ni onboarding reales.

También se puede importar `resetDemoState()` desde `src/demo/demo.controller.ts`.
El helper limpia el estado; el control de pantalla además navega al onboarding.
“Volver a la bienvenida” también inicia una toma limpia. “Ir al inicio” prepara una wallet
demo y marca el onboarding demo completo sin cambiar el saldo de la toma actual.

## Recorrido exacto

1. ⋯ → Empezar de nuevo. “Hola 👋 Soy Pato” → **Mostrame**.
2. Tocar **100 USDC** → Staking activo / + rendimiento → **Eso me gusta**.
3. Elegir **Viaje** → Viaje Bariloche, Tici 50 / Joaco 50 / Sofi 40, total 140 → **Seguir**.
4. Activar **Spotify** → **Que Pato se ocupe**.
5. Elegir **Equilibrado** → **Me quedo con esta**.
6. Nombre **Joaco** precargado → Continuar; **@joaco** precargado → Continuar.
7. **Activar Face ID** → Face ID configurado ✓ → Continuar (sin diálogo del sistema).
8. **Crear wallet** → Preparando tu wallet (1100 ms) → Wallet creada ✓, Tu wallet → Continuar → **Entrar a Pato Pay**.
9. Home: saludo con el nombre elegido en el onboarding, **52.30 USDC**, actividad inicial.
10. **Grupos** → **Asado del viernes**: cinco personas y fondo de 120 USDC.
11. **Pagar** o **Solicitud de pago · 10 USDC**.
12. **Aprobar y pagar**: reglas (500 ms), aprobación (500 ms), preparación (700 ms), envío (900 ms).
13. **¡Listo!** → transacción completada; **Ver detalle** muestra el importe del pago sin abrir URLs. Volver al inicio: **42.30 USDC**.
14. Botón ⋯ → **Pago automático · 3 USDC**: se paga sin aprobación. Saldo **39.30 USDC**.
15. Botón ⋯ → **Pago fuera del límite · 100 USDC**: bloqueado, sin botón de pago ni débito.

Demo Control también permite saltar al Home y mostrar success directamente.
“Ver comprobante” agrega una transacción de presentación sin debitar saldo.
Para repetir el video con el mismo saldo y reglas, reiniciar la demo.
Si se modifican las reglas en Permisos, los pagos posteriores respetan esos límites.

## Arquitectura y verificación

- `src/demo/`: configuración, tipos, datos iniciales, persistencia serializada y reset.
- `src/services/demo/`: wallet compatible con WalletService, pagos, reglas, grupos y staking.
- Los selectores públicos de wallet, datos y grupos conservan sus interfaces.
- El modo demo evita inicializar Stellar y passkeys; seguridad devuelve resultados locales.
- Pagos idempotentes: un doble toque no debita dos veces. Reset invalida pagos en curso.
- Los tiempos individuales son menores a 1.5 segundos y no se muestran porcentajes de rendimiento en la demo.

Verificar: `npm run typecheck` y `node scripts/test-demo.cjs`.
La prueba ejecuta los servicios TypeScript con almacenamiento aislado, sin red y
reloj virtual; cubre selección de servicios, autorización, autopago, bloqueo,
rechazo, doble pago, saldo, biometría simulada, aislamiento y reset durante pago.

Las integraciones reales no se eliminaron. Este trabajo no verifica pagos en la
red real ni Face ID en un dispositivo físico; la grabación final debe revisarse
en el dispositivo que se va a usar.

## Archivos modificados o agregados

- `.env.example`
- `DEMO_MODE.md`
- `app/(tabs)/activity.tsx`
- `app/(tabs)/groups.tsx`
- `app/(tabs)/index.tsx`
- `app/demo.tsx`
- `app/fund.tsx`
- `app/group/[id].tsx`
- `app/index.tsx`
- `app/onboarding/app-lock.tsx`
- `app/onboarding/complete.tsx`
- `app/onboarding/index.tsx`
- `app/onboarding/name.tsx`
- `app/onboarding/notifications.tsx`
- `app/onboarding/passkey.tsx`
- `app/onboarding/username.tsx`
- `app/onboarding/wallet.tsx`
- `app/payment/request.tsx`
- `app/payment/send.tsx`
- `app/payment/success.tsx`
- `scripts/test-demo.cjs`
- `src/components/DemoBadge.tsx`
- `src/components/PaymentRequestFlow.tsx`
- `src/components/Screen.tsx`
- `src/demo/demo.config.ts`
- `src/demo/demo.controller.ts`
- `src/demo/demo.data.ts`
- `src/demo/demo.types.ts`
- `src/features/onboarding/hooks/useEducationFlow.ts`
- `src/features/onboarding/services/onboardingStorage.ts`
- `src/features/onboarding/steps/BalanceStep.tsx`
- `src/features/onboarding/steps/ServicesStep.tsx`
- `src/features/onboarding/steps/SharedFundStep.tsx`
- `src/features/onboarding/store/OnboardingProvider.tsx`
- `src/services/appDataService.ts`
- `src/services/demo/demo-group.service.ts`
- `src/services/demo/demo-payment.service.ts`
- `src/services/demo/demo-policy.service.ts`
- `src/services/demo/demo-staking.service.ts`
- `src/services/demo/demo-wallet.service.ts`
- `src/services/eventService.ts`
- `src/services/security/local-auth.service.ts`
- `src/services/wallet/index.ts`

Los textos de presentación no mencionan demo, simulación ni Testnet. Los identificadores
siguen marcados internamente como DEMO; se ocultan en la interfaz, sin convertirlos
en direcciones o comprobantes de blockchain reales. Los controles se abren con ⋯.
