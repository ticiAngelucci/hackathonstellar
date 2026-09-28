import {apiRequest} from '@/services/api/patopayApi';
import type {ApiPaymentRequest,ApiPaymentCreated,ApiRequestStatus} from '@/services/api/types';
export const paymentRepository={
 list(_userId:string){return apiRequest<ApiPaymentRequest[]>('/api/v1/payment-requests');},
 get(id:string,_userId:string){return apiRequest<ApiPaymentRequest>(`/api/v1/payment-requests/${encodeURIComponent(id)}`);},
 create(input:{payer_profile_id:string;amount_minor:string;asset_id:string;memo:string|null},key:string){return apiRequest<ApiPaymentCreated>('/api/v1/payment-requests',{method:'POST',headers:{'Idempotency-Key':key},body:JSON.stringify(input)});},
 decide(id:string,action:'approve'|'reject',expectedVersion:number,key:string){return apiRequest<{id:string;status:ApiRequestStatus;version:number;next_action:string|null}>(`/api/v1/payment-requests/${encodeURIComponent(id)}/${action}`,{method:'POST',headers:{'Idempotency-Key':key},body:JSON.stringify({expected_version:expectedVersion})});},
};
