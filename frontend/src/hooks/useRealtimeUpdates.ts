import {useEffect,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {useAuth} from '@/features/auth/AuthProvider';
import {usePaymentRequests} from './usePaymentRequests';
import {useGroups} from './useGroups';
import {realtimeEnabled,subscribeUserUpdates,type LiveTopic} from '@/services/realtime/realtime.service';
const affected:Record<LiveTopic,string[]>={payments:['paymentRequests','paymentRequest','transactions','walletBalance'],groups:['groups','group','groupFund'],policy:['policy'],services:['services'],profile:['profile']};
export function useRealtimeUpdates(){
 const {session}=useAuth();const cache=useQueryClient();const requests=usePaymentRequests();const groups=useGroups();const [connected,setConnected]=useState(false);
 const userId=session?.user.id;const requestIds=(requests.data??[]).map(r=>r.id).sort().join(',');const groupIds=(groups.data??[]).map(g=>g.id).sort().join(',');
 useEffect(()=>{
  if(!userId||!realtimeEnabled)return;
  let active=true;
  const stop=subscribeUserUpdates(userId,requestIds?requestIds.split(','):[],groupIds?groupIds.split(','):[],topic=>{
   if(active)for(const key of affected[topic])void cache.invalidateQueries({queryKey:[key,userId]});
  },value=>{if(active)setConnected(value);});
  return ()=>{active=false;stop();};
 },[cache,userId,requestIds,groupIds]);
 return {enabled:realtimeEnabled,connected};
}
