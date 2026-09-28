import type {AuthChangeEvent,EmailOtpType,Session} from '@supabase/supabase-js';
import {supabaseAuthRepository} from '@/repositories/supabase/auth.repository';
import {env} from '@/config/env';
import {AppError} from '@/lib/errors';
import {getAuthRedirectUrl} from './auth-redirect';

function callbackParams(url:string){
 const parsed=new URL(url);
 const params=new URLSearchParams(parsed.search);
 const fragment=new URLSearchParams(parsed.hash.replace(/^#/,''));
 fragment.forEach((value,key)=>params.set(key,value));
 return params;
}

function callbackError(error:unknown,code?:string){
 const message=error instanceof Error?error.message:String(error??'');
 const detail=`${code??''} ${message}`.toLowerCase();
 if(detail.includes('already')&&detail.includes('confirm'))return new AppError('Tu cuenta ya fue confirmada. Iniciá sesión para continuar.','already_confirmed');
 if(detail.includes('expired')||detail.includes('otp_expired'))return new AppError('Este enlace ya venció. Solicitá uno nuevo.','expired_link');
 if(detail.includes('code verifier')||detail.includes('pkce'))return new AppError('Abrí el enlace en el mismo dispositivo donde creaste la cuenta.','pkce_device_mismatch');
 if(detail.includes('fetch')||detail.includes('network'))return new AppError('No pudimos conectarnos. Reintentá.','network');
 if(detail.includes('invalid')||detail.includes('token'))return new AppError('Este enlace no es válido o ya venció.','invalid_link');
 return new AppError('No pudimos confirmar tu cuenta. Reintentá.','confirmation_failed');
}

async function existingSession(){
 const {data}=await supabaseAuthRepository.getSession();
 return data.session;
}

export const authService={
 async signUp(email:string,password:string){if(env.demoMode)throw new AppError('La creación de cuentas reales no está disponible en modo demo.','unsupported');const redirectUrl=getAuthRedirectUrl();if(typeof __DEV__!=='undefined'&&__DEV__)console.log('[Auth] email redirect:',redirectUrl);const {data,error}=await supabaseAuthRepository.signUp(email.trim(),password,redirectUrl);if(error){if(typeof __DEV__!=='undefined'&&__DEV__)console.error('[Pato Pay auth sign-up]',error);throw new AppError('No pudimos crear tu cuenta. Revisá los datos e intentá nuevamente.');}return data;},
 async signIn(email:string,password:string){if(env.demoMode)throw new AppError('El inicio de sesión real no está disponible en modo demo.','unsupported');const {data,error}=await supabaseAuthRepository.signIn(email.trim(),password);if(error){if(typeof __DEV__!=='undefined'&&__DEV__)console.error('[Pato Pay auth sign-in]',error);throw new AppError('No pudimos iniciar sesión. Revisá tu email y contraseña.');}return data;},
 async signOut(){const {error}=await supabaseAuthRepository.signOut();if(error)throw new AppError('No pudimos cerrar la sesión. Probá nuevamente.');},
 async getSession(){const {data,error}=await supabaseAuthRepository.getSession();if(error)throw new AppError('No pudimos recuperar tu sesión.');return data.session;},
 async getCurrentUser(){const {data,error}=await supabaseAuthRepository.getCurrentUser();if(error)throw new AppError('Volvé a iniciar sesión.','unauthenticated');return data.user;},
 onAuthStateChange(callback:(event:AuthChangeEvent,session:Session|null)=>void){return supabaseAuthRepository.onAuthStateChange(async(event,session)=>{callback(event,session);}).data.subscription;},
 startAutoRefresh(){supabaseAuthRepository.startAutoRefresh();},
 stopAutoRefresh(){supabaseAuthRepository.stopAutoRefresh();},
 async completeEmailConfirmation(url:string):Promise<Session>{
  if(env.demoMode)throw new AppError('La confirmación de email no se ejecuta en modo demo.','unsupported');
  let params:URLSearchParams;
  try{params=callbackParams(url);}catch{throw new AppError('No pudimos leer este enlace de confirmación.','invalid_link');}
  const remoteError=params.get('error_description')||params.get('error');
  const remoteCode=params.get('error_code')??undefined;
  if(remoteError){
   if(remoteError.toLowerCase().includes('already')){const session=await existingSession();if(session)return session;}
   throw callbackError(new Error(remoteError),remoteCode);
  }
  const code=params.get('code');
  const accessToken=params.get('access_token');
  const refreshToken=params.get('refresh_token');
  const tokenHash=params.get('token_hash');
  let result:{data:{session:Session|null};error:Error|null};
  if(code){
   result=await supabaseAuthRepository.exchangeCodeForSession(code,params.get('sb_flow_id')??undefined);
  }else if(accessToken&&refreshToken){
   result=await supabaseAuthRepository.setSession(accessToken,refreshToken);
  }else if(tokenHash){
   result=await supabaseAuthRepository.verifyTokenHash(tokenHash,(params.get('type')||'signup') as EmailOtpType);
  }else{
   const session=await existingSession();
   if(session)return session;
   throw new AppError('Este enlace no contiene una confirmación válida.','missing_callback_params');
  }
  if(result.error||!result.data.session){
   const session=await existingSession();
   if(session)return session;
   if(typeof __DEV__!=='undefined'&&__DEV__)console.error('[Auth callback failed]',{name:result.error?.name,code:(result.error as {code?:string}|null)?.code,message:result.error?.message});
   throw callbackError(result.error);
  }
  return result.data.session;
 },
};
export async function requireUserId(){const session=await authService.getSession();const user=session?.user;if(!user)throw new AppError('Iniciá sesión para continuar.','unauthenticated');return user.id;}
export async function dataUserId(){return env.demoMode?'demo':requireUserId();}
