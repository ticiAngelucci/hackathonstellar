import {appDatabase} from '@/lib/supabase';
import {AppError,checkResult} from '@/lib/errors';
import type {ProfileRepository} from '@/repositories/contracts';

export const supabaseProfileRepository:ProfileRepository={
  async get(id){
    const {data,error}=await appDatabase().from('profiles').select('id,username,display_name,notifications_enabled,created_at,updated_at').eq('id',id).maybeSingle();
    checkResult(error,'No pudimos cargar tu perfil.');
    return data;
  },
  async update(id,input){
    const values={id,display_name:input.displayName.trim(),username:input.username.trim().toLowerCase().replace(/^@/,''),notifications_enabled:input.notificationsEnabled,updated_at:new Date().toISOString()};
    const {data,error}=await appDatabase().from('profiles').upsert(values,{onConflict:'id'}).select('id,username,display_name,notifications_enabled,created_at,updated_at').single();
    checkResult(error,'No pudimos guardar tu perfil.');
    return data!;
  },
  async lookup(username){
    const normalized=username.trim().toLowerCase().replace(/^@/,'');
    const {data,error}=await appDatabase().from('profile_directory').select('id,username,display_name').eq('username',normalized).maybeSingle();
    checkResult(error,'No pudimos buscar ese usuario.');
    if(!data)throw new AppError('No encontramos ese usuario.','not_found');
    return data;
  },
};
