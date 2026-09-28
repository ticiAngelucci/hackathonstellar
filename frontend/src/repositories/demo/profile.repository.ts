import {loadOnboardingProfile,saveOnboardingProfile} from '@/features/onboarding/services/onboardingStorage';
import {AppError} from '@/lib/errors';
import type {ProfileRepository} from '@/repositories/contracts';

const dates=()=>new Date(0).toISOString();
export const demoProfileRepository:ProfileRepository={
  async get(){
    const profile=await loadOnboardingProfile();
    return profile?{id:'demo',display_name:profile.displayName,username:profile.username,notifications_enabled:profile.notificationsEnabled,created_at:dates(),updated_at:dates()}:null;
  },
  async update(_id,input){
    const profile=await loadOnboardingProfile();
    if(profile)await saveOnboardingProfile({...profile,...input});
    return {id:'demo',display_name:input.displayName,username:input.username,notifications_enabled:input.notificationsEnabled,created_at:dates(),updated_at:new Date().toISOString()};
  },
  async lookup(){throw new AppError('La búsqueda de usuarios no está disponible en demo.','unsupported');},
};
