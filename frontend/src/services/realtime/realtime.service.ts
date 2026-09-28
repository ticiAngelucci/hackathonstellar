import {getSupabase} from '@/lib/supabase';
import {env} from '@/config/env';
export type LiveTopic='payments'|'groups'|'policy'|'services'|'profile';
export const realtimeEnabled=env.realtimeEnabled;
export function subscribeUserUpdates(userId:string,_requestIds:string[],groupIds:string[],onChange:(topic:LiveTopic)=>void,onStatus:(connected:boolean)=>void){
 if(!realtimeEnabled)return ()=>{};
 const client=getSupabase();const channel=client.channel(`patopay:user:${userId}`);
 const watch=(table:string,filter:string,topic:LiveTopic)=>{channel.on('postgres_changes',{event:'*',schema:'patopay',table,filter},()=>onChange(topic));};
 watch('payment_requests',`payer_id=eq.${userId}`,'payments');
 watch('payment_requests',`requester_id=eq.${userId}`,'payments');
 watch('event_participants',`user_id=eq.${userId}`,'groups');
 watch('events',`owner_id=eq.${userId}`,'groups');
 watch('payment_policy_versions',`user_id=eq.${userId}`,'policy');
 watch('service_subscriptions',`user_id=eq.${userId}`,'services');
 watch('profiles',`id=eq.${userId}`,'profile');
 if(groupIds.length)watch('events',`id=in.(${groupIds.slice(0,100).join(',')})`,'groups');
 channel.subscribe(status=>{onStatus(status==='SUBSCRIBED');if(status==='SUBSCRIBED'){onChange('payments');onChange('groups');}});
 return ()=>{void client.removeChannel(channel);};
}
