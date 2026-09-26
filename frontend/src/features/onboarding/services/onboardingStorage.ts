import {DEMO_MODE,DEMO_PREFIX} from '@/demo/demo.config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {OnboardingProfile} from '@/features/onboarding/types';

// Real drafts belong to one Auth user. Never hydrate another account's local profile.
async function keys(userId?:string|null){
 if(DEMO_MODE)return {profile:DEMO_PREFIX+'profile',completed:DEMO_PREFIX+'completed'};
 const id=userId===undefined?(await require('@/services/auth/auth.service').authService.getSession())?.user.id:userId;
 const prefix=`patopay:onboarding:v2:${id??'draft'}:`;
 return {profile:prefix+'profile',completed:prefix+'completed'};
}
export async function loadOnboardingProfile(userId?:string|null){const raw=await AsyncStorage.getItem((await keys(userId)).profile);return raw?JSON.parse(raw) as OnboardingProfile:null;}
export async function saveOnboardingProfile(profile:OnboardingProfile,userId?:string|null){return AsyncStorage.setItem((await keys(userId)).profile,JSON.stringify(profile));}
export async function markOnboardingCompleted(userId?:string|null){return AsyncStorage.setItem((await keys(userId)).completed,'true');}
export async function hasCompletedOnboarding(userId?:string|null){return await AsyncStorage.getItem((await keys(userId)).completed)==='true';}
