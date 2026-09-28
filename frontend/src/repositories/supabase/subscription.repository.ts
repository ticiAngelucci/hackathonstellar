import {appDatabase} from '@/lib/supabase';
import {checkResult} from '@/lib/errors';
import type {SubscriptionRepository} from '@/repositories/contracts';

export const supabaseSubscriptionRepository:SubscriptionRepository={
  async list(userId){
    const {data,error}=await appDatabase().from('service_subscriptions').select('user_id,service_id,enabled,updated_at').eq('user_id',userId);
    checkResult(error,'No pudimos cargar tus servicios.');
    return data??[];
  },
  async set(userId,serviceId,enabled){
    const {data,error}=await appDatabase().from('service_subscriptions').upsert({user_id:userId,service_id:serviceId,enabled,updated_at:new Date().toISOString()},{onConflict:'user_id,service_id'}).select('user_id,service_id,enabled,updated_at').single();
    checkResult(error,'No pudimos actualizar ese servicio.');
    return data!;
  },
};
