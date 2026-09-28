import {env} from '@/config/env';

export const DEMO_MODE=env.demoMode;
export const DEMO_TIMINGS={short:350,medium:700,long:1100} as const;
export const DEMO_PREFIX='patopay:demo:v1:';
export const demoWait=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
export function assertDemo(){if(!DEMO_MODE)throw new Error('Demo mode is disabled.');}
