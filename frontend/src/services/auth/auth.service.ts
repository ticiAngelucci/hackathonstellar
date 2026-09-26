import type {AuthChangeEvent,Session} from '@supabase/supabase-js';
import {getSupabase} from '@/lib/supabase';
import {AppError} from '@/lib/errors';
export const authService={
 async signUp(email:string,password:string){const {data,error}=await getSupabase().auth.signUp({email:email.trim(),password});if(error)throw new AppError('No pudimos crear tu cuenta. Revisá los datos e intentá nuevamente.');return data;},
 async signIn(email:string,password:string){const {data,error}=await getSupabase().auth.signInWithPassword({email:email.trim(),password});if(error)throw new AppError('No pudimos iniciar sesión. Revisá tu email y contraseña.');return data;},
 async signOut(){const {error}=await getSupabase().auth.signOut();if(error)throw new AppError('No pudimos cerrar la sesión. Probá nuevamente.');},
 async getSession(){const {data,error}=await getSupabase().auth.getSession();if(error)throw new AppError('No pudimos recuperar tu sesión.');return data.session;},
 async getCurrentUser(){const {data,error}=await getSupabase().auth.getUser();if(error)throw new AppError('Volvé a iniciar sesión.','unauthenticated');return data.user;},
 onAuthStateChange(callback:(event:AuthChangeEvent,session:Session|null)=>void){return getSupabase().auth.onAuthStateChange(callback).data.subscription;},
};
export async function requireUserId(){const session=await authService.getSession();const user=session?.user;if(!user)throw new AppError('Iniciá sesión para continuar.','unauthenticated');return user.id;}
