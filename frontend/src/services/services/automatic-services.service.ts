import {subscriptionRepository} from '@/repositories/subscription.repository';
import {requireUserId} from '@/services/auth/auth.service';
import {AppError} from '@/lib/errors';
export const realSubscriptionService={
 async list(){return new Map((await subscriptionRepository.list(await requireUserId())).map(row=>[row.service_id,row.enabled]));},
 async set(serviceId:string,enabled:boolean){if(!['electricity','internet','water'].includes(serviceId))throw new AppError('No encontramos ese servicio.');return subscriptionRepository.set(await requireUserId(),serviceId,enabled);},
};
