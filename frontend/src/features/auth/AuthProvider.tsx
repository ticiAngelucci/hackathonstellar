import {onDemoReset} from '@/demo/demo.controller';
import {Fragment,createContext,useContext,useEffect,useRef,useState,type PropsWithChildren} from 'react';
import {AppState,Platform} from 'react-native';
import {Redirect,useSegments,useRootNavigationState,useRouter} from 'expo-router';
import type {Session} from '@supabase/supabase-js';
import {DEMO_MODE} from '@/demo/demo.config';
import {authService} from '@/services/auth/auth.service';
import {getSupabase} from '@/lib/supabase';
import {queryClient} from '@/lib/query-client';
const Context=createContext<{session:Session|null;ready:boolean}>({session:null,ready:false});
export const useAuth=()=>useContext(Context);
export function AuthProvider({children}:PropsWithChildren){
 const currentUser=useRef<string|undefined>(undefined);
 const [session,setSession]=useState<Session|null>(null);const [ready,setReady]=useState(DEMO_MODE);
 useEffect(()=>{
  if(DEMO_MODE)return onDemoReset(()=>queryClient.clear());
  let active=true;
  let subscription:ReturnType<typeof authService.onAuthStateChange>|undefined;
  try{
   subscription=authService.onAuthStateChange((_event,next)=>{if(!active)return;if(currentUser.current!==next?.user.id){queryClient.clear();currentUser.current=next?.user.id;}setSession(next);setReady(true);});
   void authService.getSession().then(next=>{if(active){setSession(next);setReady(true);}}).catch(()=>{if(active)setReady(true);});
  }catch{setReady(true);}
  const appState=Platform.OS==='web'?null:AppState.addEventListener('change',state=>{try{if(state==='active')getSupabase().auth.startAutoRefresh();else getSupabase().auth.stopAutoRefresh();}catch{}});
  return ()=>{active=false;subscription?.unsubscribe();appState?.remove();};
 },[]);
 return <Context.Provider value={{session,ready}}>{children}</Context.Provider>;
}
export function AuthBoundary({children}:PropsWithChildren){
 const {session,ready}=useAuth();const segments=useSegments();
 if(DEMO_MODE)return children;
 if(!ready)return null;
 const root=segments[0];
 if(!session&&root&&root!=='auth'&&root!=='onboarding'&&root!=='demo')return <Redirect href="/auth"/>;
 return <Fragment key={session?.user.id??'signed-out'}>{children}</Fragment>;
}

export function NavigationGuard(){
 const {session,ready}=useAuth();const segments=useSegments();const navigation=useRootNavigationState();const router=useRouter();
 const root=segments[0];const step=segments[1];
 const protectedRoute=Boolean(root&&root!=='auth'&&root!=='demo'&&(root!=='onboarding'||['wallet','passkey','policy','notifications','app-lock','complete'].includes(step??'')));
 useEffect(()=>{if(!DEMO_MODE&&navigation?.key&&ready&&!session&&protectedRoute)router.replace('/auth');},[navigation?.key,ready,session,protectedRoute,router]);
 return null;
}
