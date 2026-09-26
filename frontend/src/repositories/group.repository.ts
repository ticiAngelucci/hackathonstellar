import {apiRequest,PatoPayApiError} from '@/services/api/patopayApi';
import type {ApiEvent} from '@/services/api/types';
import {AppError} from '@/lib/errors';
export const groupRepository={
 list(_userId?:string){return apiRequest<ApiEvent[]>('/api/v1/events');},
 async get(id:string){const event=(await groupRepository.list()).find(e=>e.id===id);if(!event)throw new PatoPayApiError(404);return event;},
 create(_userId:string,name:string){return apiRequest<ApiEvent>('/api/v1/events',{method:'POST',body:JSON.stringify({name})});},
 async update(_id:string,_userId:string,_name:string,_version:number):Promise<ApiEvent>{throw new AppError('La edición de grupos todavía no está disponible.','unsupported');},
 async members(id:string,_userId:string){return (await groupRepository.get(id)).participants;},
};
