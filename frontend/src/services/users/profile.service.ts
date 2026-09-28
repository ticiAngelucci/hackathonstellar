import {profileRepository} from '@/repositories/profile.repository';
import {dataUserId} from '@/services/auth/auth.service';
import {AppError} from '@/lib/errors';
import type {ProfileRow} from '@/types/database.generated';
import type {ProfileUpdate,UserProfile} from '@/types/domain';
export const mapProfile=(row:ProfileRow):UserProfile=>({id:row.id,displayName:row.display_name??'',username:row.username??'',notificationsEnabled:row.notifications_enabled});
function normalizeUsername(username:string){
 const value=username.trim().toLowerCase().replace(/^@/,'');
 if(!/^[a-z0-9_]{3,40}$/.test(value))throw new AppError('El usuario debe tener entre 3 y 40 caracteres: letras minúsculas, números o _.');
 return value;
}
export const profileService={
 async findProfile(username:string){return profileRepository.lookup(normalizeUsername(username));},
 async getProfile(){const row=await profileRepository.get(await dataUserId());return row?mapProfile(row):null;},
 async updateProfile(input:ProfileUpdate){const displayName=input.displayName.trim();if(!displayName||displayName.length>120)throw new AppError('El nombre debe tener entre 1 y 120 caracteres.');return mapProfile(await profileRepository.update(await dataUserId(),{...input,displayName,username:normalizeUsername(input.username)}));},
};
