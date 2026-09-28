import {getSupabase} from '@/lib/supabase';

export const supabaseAuthRepository={
  signUp(email:string,password:string,emailRedirectTo:string){return getSupabase().auth.signUp({email,password,options:{emailRedirectTo}});},
  signIn(email:string,password:string){return getSupabase().auth.signInWithPassword({email,password});},
  signOut(){return getSupabase().auth.signOut();},
  getSession(){return getSupabase().auth.getSession();},
  getCurrentUser(){return getSupabase().auth.getUser();},
  exchangeCodeForSession(code:string,flowId?:string){return getSupabase().auth.exchangeCodeForSession(code,flowId?{flowId}:undefined);},
  setSession(accessToken:string,refreshToken:string){return getSupabase().auth.setSession({access_token:accessToken,refresh_token:refreshToken});},
  verifyTokenHash(tokenHash:string,type:import('@supabase/supabase-js').EmailOtpType){return getSupabase().auth.verifyOtp({token_hash:tokenHash,type});},
  onAuthStateChange(callback:Parameters<ReturnType<typeof getSupabase>['auth']['onAuthStateChange']>[0]){return getSupabase().auth.onAuthStateChange(callback);},
  startAutoRefresh(){getSupabase().auth.startAutoRefresh();},
  stopAutoRefresh(){getSupabase().auth.stopAutoRefresh();},
};
