export const DEMO_MODE=process.env.EXPO_PUBLIC_DEMO_MODE==='true';
export const DEMO_TIMINGS={short:350,medium:700,long:1100} as const;
export const DEMO_PREFIX='patopay:demo:v1:';
export const demoWait=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
export function assertDemo(){if(!DEMO_MODE)throw new Error('Demo mode is disabled.');}
