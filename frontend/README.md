# Pato Pay — app mobile

Frontend Expo de Pato Pay con Stellar Testnet, smart wallet con passkey y modo
mock optativo para desarrollo visual.

**Stack:** Expo + React Native + TypeScript + Expo Router + Reanimated.

La integración y los comandos completos están en
[`STELLAR_INTEGRATION.md`](./STELLAR_INTEGRATION.md).

## Arquitectura
- `app/`: navegación y screens
- `src/components/`: componentes reutilizables
- `src/services/`: Stellar, wallet, Supabase y seguridad local
- `src/types/`: modelos compartidos
- `assets/`: mascota

## Modos de wallet

- `stellar` (default): smart wallet real en Stellar Testnet, firmada con passkey.
- `mock`: fallback explícito para trabajar sólo la interfaz.

Face ID/Touch ID protege el acceso a la app y nunca firma operaciones Stellar.

## Backend local

La guía para levantar y probar la API FastAPI está en
[`BACKEND_INTEGRATION.md`](./BACKEND_INTEGRATION.md).

## Flujos incluidos
Onboarding, home, grupos, fondo común/staking, servicios automáticos, permisos, payment request, success, actividad y perfil.
