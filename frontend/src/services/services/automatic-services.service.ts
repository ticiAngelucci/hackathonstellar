import {subscriptionRepository} from '@/repositories/subscription.repository';
import {dataUserId} from '@/services/auth/auth.service';
import {AppError} from '@/lib/errors';
import {serviceCatalog} from '@/constants/serviceCatalog';
import type {ServiceId} from '@/repositories/contracts';
export const subscriptionService={
 async list(){return new Map((await subscriptionRepository.list(await dataUserId())).map(row=>[row.service_id,row.enabled]));},
 async set(serviceId:string,enabled:boolean){if(!serviceCatalog.some(service=>service.id===serviceId))throw new AppError('No encontramos ese servicio.');return (await subscriptionRepository.set(await dataUserId(),serviceId as ServiceId,enabled)).enabled;},
};
