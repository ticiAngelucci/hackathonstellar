import {createContext,PropsWithChildren,useContext,useEffect,useMemo,useRef,useState} from 'react';
import {useAuth} from '@/features/auth/AuthProvider';
import {DEMO_MODE} from '@/demo/demo.config';
import {onDemoReset} from '@/demo/demo.controller';
import {profileService} from '@/services/users/profile.service';
import {loadOnboardingProfile,saveOnboardingProfile} from '@/features/onboarding/services/onboardingStorage';
import type {OnboardingProfile} from '@/features/onboarding/types';
const initialProfile:OnboardingProfile={educationStep:1,displayName:'',username:'',walletCreated:false,passkeyCreated:false,notificationsEnabled:false,policyPreset:'balanced'};
type OnboardingContextValue={profile:OnboardingProfile;hydrated:boolean;updateProfile:(patch:Partial<OnboardingProfile>)=>void};
const OnboardingContext=createContext<OnboardingContextValue|null>(null);
export function OnboardingProvider({children}:PropsWithChildren){
 const {session,ready}=useAuth();const userId=session?.user.id??null;const key=DEMO_MODE?'demo':userId??'draft';
 const [profile,setProfile]=useState(initialProfile);const [loadedKey,setLoadedKey]=useState<string|null>(null);
 const latest=useRef(profile);const previousKey=useRef<string|null>(null);
 const hydrated=loadedKey===key&&(DEMO_MODE||ready);
 useEffect(()=>{latest.current=profile;},[profile]);
 useEffect(()=>{
  if(!DEMO_MODE&&!ready)return;
  let active=true;
  // A just-created account may adopt its in-progress anonymous UI draft, never another user's.
  const draft=previousKey.current==='draft'&&userId?latest.current:initialProfile;
  previousKey.current=key;
  const hydrate=async()=>{
   const saved=await loadOnboardingProfile(userId);
   let next={...initialProfile,...(saved??draft)};
   if(!DEMO_MODE&&userId){try{const remote=await profileService.getProfile();if(remote?.username)next={...next,displayName:remote.displayName,username:remote.username,notificationsEnabled:remote.notificationsEnabled};}catch{}}
   if(active){setProfile(next);setLoadedKey(key);}
  };
  void hydrate().catch(()=>{if(active){setProfile(initialProfile);setLoadedKey(key);}});
  return ()=>{active=false;};
 },[key,ready,userId]);
 useEffect(()=>{if(hydrated)void saveOnboardingProfile(profile,userId).catch(()=>{});},[hydrated,profile,userId]);
 useEffect(()=>DEMO_MODE?onDemoReset(()=>setProfile({...initialProfile})):undefined,[]);
 const value=useMemo<OnboardingContextValue>(()=>({profile:hydrated?profile:initialProfile,hydrated,updateProfile:patch=>setProfile(current=>({...current,...patch}))}),[hydrated,profile]);
 return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}
export function useOnboarding(){const context=useContext(OnboardingContext);if(!context)throw new Error('useOnboarding debe usarse dentro de OnboardingProvider.');return context;}
