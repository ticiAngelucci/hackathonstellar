import {apiRequest,PatoPayApiError} from '@/services/api/patopayApi';
import type {ApiPolicy} from '@/services/api/types';
export type PolicyWrite=Omit<ApiPolicy,'id'|'version'>&{expected_version:number};
export const policyRepository={
 async latest(_userId?:string){try{return await apiRequest<ApiPolicy>('/api/v1/me/payment-policy');}catch(error){if(error instanceof PatoPayApiError&&error.status===404)return null;throw error;}},
 create(input:PolicyWrite){return apiRequest<ApiPolicy>('/api/v1/me/payment-policy',{method:'PUT',body:JSON.stringify(input)});},
};
