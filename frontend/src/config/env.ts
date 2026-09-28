import {AppError} from '@/lib/errors';

export type AppMode='demo'|'real';
export type WalletMode='mock'|'stellar';

const raw={
  demoMode:process.env.EXPO_PUBLIC_DEMO_MODE?.trim().toLowerCase(),
  supabaseUrl:process.env.EXPO_PUBLIC_SUPABASE_URL?.trim()??'',
  supabaseAnonKey:(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim()||process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim())??'',
  walletMode:process.env.EXPO_PUBLIC_WALLET_MODE?.trim().toLowerCase(),
  stellarNetwork:process.env.EXPO_PUBLIC_STELLAR_NETWORK?.trim().toLowerCase(),
  realtime:process.env.EXPO_PUBLIC_ENABLE_REALTIME?.trim().toLowerCase(),
};

const demoMode=raw.demoMode==='true';

export const env={
  mode:(demoMode?'demo':'real') as AppMode,
  demoMode,
  supabaseUrl:raw.supabaseUrl,
  supabaseAnonKey:raw.supabaseAnonKey,
  walletMode:(raw.walletMode||'mock') as WalletMode,
  stellarNetwork:raw.stellarNetwork||'testnet',
  realtimeEnabled:!demoMode&&raw.realtime==='true',
} as const;

export function validateEnvironment(){
  if(raw.demoMode&&raw.demoMode!=='true'&&raw.demoMode!=='false'){
    throw new AppError('EXPO_PUBLIC_DEMO_MODE debe ser true o false.','configuration');
  }
  if(env.walletMode!=='mock'&&env.walletMode!=='stellar'){
    throw new AppError('EXPO_PUBLIC_WALLET_MODE debe ser mock o stellar.','configuration');
  }
  if(env.stellarNetwork!=='testnet'){
    throw new AppError('EXPO_PUBLIC_STELLAR_NETWORK debe ser testnet.','configuration');
  }
  if(raw.realtime&&raw.realtime!=='true'&&raw.realtime!=='false'){
    throw new AppError('EXPO_PUBLIC_ENABLE_REALTIME debe ser true o false.','configuration');
  }
  if(env.demoMode)return env;
  if(!env.supabaseUrl||!env.supabaseAnonKey){
    throw new AppError('Falta configurar la conexión remota de Supabase.','configuration');
  }
  try{
    const url=new URL(env.supabaseUrl);
    if(url.protocol!=='https:')throw new Error('Supabase must use HTTPS');
  }catch{
    throw new AppError('EXPO_PUBLIC_SUPABASE_URL debe ser una URL HTTPS válida.','configuration');
  }
  return env;
}

export const dataScope=(userId?:string)=>env.demoMode?'demo':userId;
export const dataReady=(userId?:string)=>env.demoMode||Boolean(userId);
