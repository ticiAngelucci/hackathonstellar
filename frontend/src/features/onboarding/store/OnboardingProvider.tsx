import {createContext,PropsWithChildren,useContext,useEffect,useMemo,useState} from 'react';
import {loadOnboardingProfile,saveOnboardingProfile} from '@/features/onboarding/services/onboardingStorage';
import {OnboardingProfile} from '@/features/onboarding/types';

const initialProfile:OnboardingProfile={
  educationStep:1,
  displayName:'',
  username:'',
  walletCreated:false,
  passkeyCreated:false,
  notificationsEnabled:false,
  policyPreset:'balanced',
};

type OnboardingContextValue={
  profile:OnboardingProfile;
  hydrated:boolean;
  updateProfile:(patch:Partial<OnboardingProfile>)=>void;
};

const OnboardingContext=createContext<OnboardingContextValue|null>(null);

export function OnboardingProvider({children}:PropsWithChildren){
  const [profile,setProfile]=useState(initialProfile);
  const [hydrated,setHydrated]=useState(false);

  useEffect(()=>{
    let active=true;
    loadOnboardingProfile()
      .then(saved=>{if(active&&saved)setProfile({...initialProfile,...saved});})
      .catch(()=>{})
      .finally(()=>{if(active)setHydrated(true);});
    return ()=>{active=false;};
  },[]);

  useEffect(()=>{
    if(hydrated)void saveOnboardingProfile(profile);
  },[hydrated,profile]);

  const value=useMemo<OnboardingContextValue>(()=>({
    profile,
    hydrated,
    updateProfile:patch=>setProfile(current=>({...current,...patch})),
  }),[hydrated,profile]);

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(){
  const context=useContext(OnboardingContext);
  if(!context)throw new Error('useOnboarding debe usarse dentro de OnboardingProvider.');
  return context;
}
