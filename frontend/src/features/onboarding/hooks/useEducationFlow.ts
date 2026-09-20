import {router} from 'expo-router';
import {useState} from 'react';
import {useOnboarding} from '@/features/onboarding/store/OnboardingProvider';

export function useEducationFlow(){
  const {profile,updateProfile}=useOnboarding();
  const [direction,setDirection]=useState<'forward'|'back'>('forward');
  const step=Math.max(1,Math.min(6,profile.educationStep||1));

  const next=()=>{
    setDirection('forward');
    if(step<6)updateProfile({educationStep:step+1});
    else router.push('/onboarding/name');
  };

  const back=()=>{
    setDirection('back');
    if(step>1)updateProfile({educationStep:step-1});
    else router.back();
  };

  return {step,direction,next,back};
}
