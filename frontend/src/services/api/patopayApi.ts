import {authService} from '@/services/auth/auth.service';
import {getSupabase} from '@/lib/supabase';
import {AppError} from '@/lib/errors';
import {DEMO_MODE} from '@/demo/demo.config';

export class PatoPayApiError extends AppError {
  constructor(readonly status:number) {
    const messages:Record<number,string>={
      0:'No pudimos conectar con Pato Pay. Revisá tu conexión e intentá nuevamente.',
      401:'Tu sesión venció. Volvé a iniciar sesión.',
      403:'Tu cuenta no tiene permiso para esta operación.',
      404:'No encontramos ese recurso o no está disponible para tu cuenta.',
      408:'El servidor tardó demasiado. Probá nuevamente.',
      409:'Los datos cambiaron o ya están en uso. Actualizá antes de reintentar.',
      422:'Revisá los datos ingresados. No cumplen los requisitos de esta operación.',
      502:'No pudimos acceder a tus datos. Probá nuevamente.',
      503:'Esta función todavía no está disponible.',
    };
    super(messages[status]??'No pudimos completar la operación. Probá nuevamente.',String(status));
  }
}
export function getApiUrl(){
  const value=process.env.EXPO_PUBLIC_PATOPAY_API_URL?.trim().replace(/\/+$/,'');
  if(!value||!/^https?:\/\//.test(value))throw new AppError('Falta configurar la conexión con Pato Pay.','configuration');
  return value;
}
export async function apiRequest<T>(path:string,init:RequestInit={}):Promise<T>{
  if(DEMO_MODE)throw new AppError('La conexión real no está disponible en este modo.','configuration');
  if(!path.startsWith('/api/v1/'))throw new AppError('Ruta de API inválida.','configuration');
  const url=getApiUrl()+path;
  let session=await authService.getSession();
  if(!session)throw new PatoPayApiError(401);
  const userId=session.user.id;
  for(let attempt=0;attempt<2;attempt++){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),10000);
    let response:Response;
    try{
      const headers=new Headers(init.headers);
      headers.set('Accept','application/json');
      headers.set('Authorization',`Bearer ${session.access_token}`);
      if(init.body)headers.set('Content-Type','application/json');
      response=await fetch(url,{...init,headers,signal:controller.signal});
      if(response.status!==401){
        if(!response.ok)throw new PatoPayApiError(response.status);
        const data=response.status===204?undefined:await response.json();
        // Ignore a late response if the user signed out or changed accounts.
        if((await authService.getSession())?.user.id!==userId)throw new PatoPayApiError(401);
        return data as T;
      }
    }catch(error){
      if(error instanceof AppError)throw error;
      throw new PatoPayApiError(controller.signal.aborted?408:0);
    }finally{clearTimeout(timer);}
    if(attempt===0){
      const refreshed=await getSupabase().auth.refreshSession();
      if(refreshed.error||!refreshed.data.session||refreshed.data.session.user.id!==userId)throw new PatoPayApiError(401);
      session=refreshed.data.session;
    }
  }
  throw new PatoPayApiError(401);
}
