import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {env,validateEnvironment} from '@/config/env';
import type {Database} from '@/types/database.generated';
import {assertPublicKey} from './public-key';
import {AppError} from './errors';
let client:SupabaseClient<Database>|undefined;
export function supabasePublicKey(){return env.supabaseAnonKey;}
export function getSupabase(){
  if(env.demoMode)throw new AppError('Esta conexión no está disponible en modo demo.','configuration');
  if(client)return client;
  const config=validateEnvironment();
  assertPublicKey(config.supabaseAnonKey);
  client=createClient<Database>(config.supabaseUrl,config.supabaseAnonKey,{auth:{storage:AsyncStorage,storageKey:'patopay:auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,flowType:'pkce'}});
  return client;
}
export const appDatabase=()=>getSupabase().schema('patopay');
