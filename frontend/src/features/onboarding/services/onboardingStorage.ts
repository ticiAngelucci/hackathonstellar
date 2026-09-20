import AsyncStorage from '@react-native-async-storage/async-storage';
import {OnboardingProfile} from '@/features/onboarding/types';

const PROFILE_KEY='patopay:onboarding:profile:v1';
const COMPLETED_KEY='patopay:onboarding:completed:v1';

export async function loadOnboardingProfile(){
  const raw=await AsyncStorage.getItem(PROFILE_KEY);
  return raw?JSON.parse(raw) as OnboardingProfile:null;
}

export function saveOnboardingProfile(profile:OnboardingProfile){
  return AsyncStorage.setItem(PROFILE_KEY,JSON.stringify(profile));
}

export function markOnboardingCompleted(){
  return AsyncStorage.setItem(COMPLETED_KEY,'true');
}

export async function hasCompletedOnboarding(){
  return await AsyncStorage.getItem(COMPLETED_KEY)==='true';
}
