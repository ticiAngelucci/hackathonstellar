import {assertPublicKey} from './public-key';
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {createClient,processLock,type SupabaseClient} from '@supabase/supabase-js';
import {DEMO_MODE} from '@/demo/demo.config';
import {AppError} from './errors';
let client:SupabaseClient|undefined;
export function supabasePublicKey(){return process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim()||process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()||'';}
export function getSupabase(){
  if(DEMO_MODE)throw new AppError('Esta conexión no está disponible.');
  if(client)return client;
  const url=process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const key=supabasePublicKey();
  if(!url||!key)throw new AppError('Falta configurar la conexión de la aplicación.','configuration');
  assertPublicKey(key);
  client=createClient(url,key,{auth:{storage:AsyncStorage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,lock:processLock}});
  return client;
}
export const appDatabase=()=>getSupabase().schema('patopay');
