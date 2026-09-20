import AsyncStorage from '@react-native-async-storage/async-storage';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';

let client:SupabaseClient|undefined;

function getClient(){
  if(client)return client;
  const url=process.env.EXPO_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/,'');
  const publishableKey=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if(!url||!publishableKey){
    throw new Error('Configurá EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY para autenticar el relayer.');
  }
  client=createClient(url,publishableKey,{
    auth:{
      storage:AsyncStorage,
      autoRefreshToken:true,
      persistSession:true,
      detectSessionInUrl:false,
    },
  });
  return client;
}

/** Returns a short-lived JWT for the relayer. This is app auth, never a wallet signer. */
export async function getRelayerAuthHeaders(){
  const supabase=getClient();
  let {data:{session},error}=await supabase.auth.getSession();
  if(error)throw error;
  if(!session){
    const result=await supabase.auth.signInAnonymously();
    if(result.error)throw result.error;
    session=result.data.session;
  }
  if(!session)throw new Error('Supabase no pudo crear una sesión para el relayer.');
  return {
    Authorization:`Bearer ${session.access_token}`,
    apikey:process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()??'',
  };
}
