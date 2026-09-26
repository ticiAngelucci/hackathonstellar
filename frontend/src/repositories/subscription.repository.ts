import {apiRequest} from '@/services/api/patopayApi';
import type {ApiSubscription} from '@/services/api/types';
export const subscriptionRepository={
 list(_userId:string){return apiRequest<ApiSubscription[]>('/api/v1/me/service-subscriptions');},
 async set(_userId:string,serviceId:string,enabled:boolean){return (await apiRequest<ApiSubscription>(`/api/v1/me/service-subscriptions/${encodeURIComponent(serviceId)}`,{method:'PUT',body:JSON.stringify({enabled})})).enabled;},
};
