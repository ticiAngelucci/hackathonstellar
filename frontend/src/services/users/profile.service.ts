import {DEMO_MODE} from '@/demo/demo.config';
import {loadOnboardingProfile,saveOnboardingProfile} from '@/features/onboarding/services/onboardingStorage';
import {profileRepository} from '@/repositories/profile.repository';
import {requireUserId} from '@/services/auth/auth.service';
import type {ApiProfile} from '@/services/api/types';
import type {ProfileUpdate,UserProfile} from '@/types/domain';
export const mapProfile=(row:ApiProfile):UserProfile=>({id:row.id,displayName:row.display_name??'',username:row.username??'',notificationsEnabled:row.notifications_enabled});
export const profileService={
 async findProfile(username:string){return profileRepository.lookup(username);},
 async getProfile(){if(DEMO_MODE){const p=await loadOnboardingProfile();return p?{id:'demo',displayName:p.displayName,username:p.username,notificationsEnabled:p.notificationsEnabled}:null;}const row=await profileRepository.get(await requireUserId());return row?mapProfile(row):null;},
 async updateProfile(input:ProfileUpdate){if(DEMO_MODE){const p=await loadOnboardingProfile();if(p)await saveOnboardingProfile({...p,...input});return {id:'demo',...input};}return mapProfile(await profileRepository.update(await requireUserId(),input));},
 async getWallets(){if(DEMO_MODE)return [];return (await profileRepository.wallets(await requireUserId())).map(w=>({id:w.id,address:w.contract_address,network:w.network,status:w.status}));},
};
