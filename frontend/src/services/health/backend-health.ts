import {env} from '@/config/env';
import {appDatabase} from '@/lib/supabase';
import {authService} from '@/services/auth/auth.service';

export type BackendHealth={mode:'DEMO'|'REAL';connected:boolean|null;authenticated:boolean;userId:string|null};

async function assertDataApiAvailable(response:Response){
  if(response.ok||[401,403].includes(response.status))return;
  const payload=await response.json().catch(()=>null) as {code?:string;message?:string}|null;
  if(payload?.code==='PGRST106'){
    throw new Error('La Data API no expone el schema "patopay" (PGRST106). Agregalo en Supabase > API Settings > Exposed schemas.');
  }
  throw new Error(`Supabase Data API respondió ${response.status}${payload?.code?` (${payload.code})`:''}.`);
}

function diagnosticMessage(error:unknown){
  if(error instanceof Error)return error.message;
  if(error&&typeof error==='object'){
    const value=error as {code?:unknown;message?:unknown};
    return [value.code,value.message].filter((item):item is string=>typeof item==='string').join(': ')||'Error desconocido.';
  }
  return String(error);
}

export async function checkBackendConnection():Promise<BackendHealth>{
  if(env.demoMode)return {mode:'DEMO',connected:null,authenticated:false,userId:null};
  try{
    const session=await authService.getSession();
    if(session){
      const {error}=await appDatabase().from('profiles').select('id').eq('id',session.user.id).limit(1);
      if(error)throw error;
    }else{
      const base=env.supabaseUrl.replace(/\/+$/,'');
      const [authResponse,dataResponse]=await Promise.all([
        fetch(`${base}/auth/v1/settings`,{headers:{apikey:env.supabaseAnonKey}}),
        fetch(`${base}/rest/v1/assets?select=id&limit=1`,{headers:{apikey:env.supabaseAnonKey,Authorization:`Bearer ${env.supabaseAnonKey}`,'Accept-Profile':'patopay'}}),
      ]);
      if(!authResponse.ok)throw new Error(`Supabase Auth responded ${authResponse.status}`);
      await assertDataApiAvailable(dataResponse);
    }
    if(typeof __DEV__!=='undefined'&&__DEV__)console.info('Supabase connected ✓');
    return {mode:'REAL',connected:true,authenticated:Boolean(session),userId:session?.user.id??null};
  }catch(error){
    if(typeof __DEV__!=='undefined'&&__DEV__)console.error('Supabase connection failed ✕',diagnosticMessage(error));
    return {mode:'REAL',connected:false,authenticated:false,userId:null};
  }
}
