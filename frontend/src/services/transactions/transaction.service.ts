import {paymentService} from '@/services/payments/payment.service';
import {dataUserId} from '@/services/auth/auth.service';
import {env} from '@/config/env';
import {readDemoState} from '@/demo/demo.controller';
import {AppError} from '@/lib/errors';
import type {PaymentRequest} from '@/types/domain';
import type {Transaction} from '@/types';
const labels={pending:'Solicitud pendiente',approved:'Aprobada · aún no pagada',processing:'Pago en proceso',paid:'Pago registrado',failed:'Pago fallido',blocked:'Bloqueado',rejected:'Rechazada',expired:'Vencida',cancelled:'Cancelada'};
export function mapActivity(request:PaymentRequest,userId:string):Transaction{
 const incoming=request.requesterId===userId;
 return {id:request.id,title:request.concept,subtitle:labels[request.status],amount:(Number(request.amount)||0)*(incoming?1:-1),displayAmount:request.amount==='—'?'—':`${incoming?'+':'−'}${request.amount}`,assetCode:request.asset,status:request.status==='paid'?(incoming?'received':'paid'):request.status,icon:request.status==='paid'?'checkmark-circle':'receipt-outline',txHash:request.txHash};
}
export const transactionService={
 async list(limit?:number){const userId=await dataUserId();const result=env.demoMode?(await readDemoState()).transactions:(await paymentService.getPaymentRequests()).map(request=>mapActivity(request,userId));return limit?result.slice(0,limit):result;},
 async get(id:string){if(env.demoMode){const transaction=(await readDemoState()).transactions.find(item=>item.id===id);if(!transaction)throw new AppError('Transacción no disponible.','not_found');return transaction;}return mapActivity(await paymentService.getPaymentRequest(id),await dataUserId());},
};
