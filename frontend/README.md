# Pato Pay — prototipo mobile

App demo navegable para la hackathon.

**Stack:** Expo + React Native + TypeScript + Expo Router + Reanimated.

```bash
npm install
npx expo start
```

## Arquitectura
- `app/`: navegación y screens
- `src/components/`: componentes reutilizables
- `src/services/`: frontera de datos; hoy mock, mañana FastAPI
- `src/data/`: fixtures
- `src/types/`: modelos compartidos
- `assets/`: mascota

## Backend futuro
Las vistas consumen interfaces de servicios. Reemplazá `mockServices.ts` por una implementación HTTP sin reescribir las screens.

## Flujos incluidos
Onboarding, home, grupos, fondo común/staking, servicios automáticos, permisos, payment request, success, actividad y perfil.
