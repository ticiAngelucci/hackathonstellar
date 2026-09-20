const REQUEST_TIMEOUT_MS=8000;

export class SupabaseError extends Error{
  constructor(message:string,readonly status?:number){
    super(message);
    this.name='SupabaseError';
  }
}

function getConfig(){
  const url=process.env.EXPO_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/,'');
  const publishableKey=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if(!url||!publishableKey||publishableKey.startsWith('replace-with')){
    throw new SupabaseError('Falta configurar la publishable key de Supabase en frontend/.env.');
  }

  return {url,publishableKey};
}

async function getErrorMessage(response:Response){
  try{
    const body=await response.json() as {message?:string;details?:string;hint?:string};
    return body.message??body.details??body.hint??`Supabase respondió ${response.status}`;
  }catch{
    return `Supabase respondió ${response.status}`;
  }
}

export async function supabaseRequest<T>(path:string,init:RequestInit={}):Promise<T>{
  const {url,publishableKey}=getConfig();
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);

  try{
    const response=await fetch(`${url}/rest/v1${path}`,{
      ...init,
      headers:{
        apikey:publishableKey,
        Accept:'application/json',
        ...(init.body?{'Content-Type':'application/json'}:{}),
        ...init.headers,
      },
      signal:controller.signal,
    });

    if(!response.ok){
      throw new SupabaseError(await getErrorMessage(response),response.status);
    }

    return await response.json() as T;
  }catch(error){
    if(error instanceof SupabaseError)throw error;
    if(error instanceof Error&&error.name==='AbortError'){
      throw new SupabaseError('Supabase tardó demasiado en responder.');
    }
    throw new SupabaseError('No pudimos conectar con Supabase.');
  }finally{
    clearTimeout(timeout);
  }
}
