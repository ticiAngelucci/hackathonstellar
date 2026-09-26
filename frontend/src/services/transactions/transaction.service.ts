import {realPaymentService} from '@/services/payments/payment.service';
import {requireUserId} from '@/services/auth/auth.service';
import type {PaymentRequest} from '@/types/domain';
import type {Transaction} from '@/types';
const labels={pending:'Solicitud pendiente',approved:'Aprobada · aún no pagada',processing:'Pago en proceso',paid:'Pago registrado',failed:'Pago fallido',blocked:'Bloqueado',rejected:'Rechazada',expired:'Vencida',cancelled:'Cancelada'};
export function mapActivity(request:PaymentRequest,userId:string):Transaction{
 const incoming=request.requesterId===userId;
 return {id:request.id,title:request.concept,subtitle:labels[request.status],amount:(Number(request.amount)||0)*(incoming?1:-1),displayAmount:request.amount==='—'?'—':`${incoming?'+':'−'}${request.amount}`,assetCode:request.asset,status:request.status==='paid'?(incoming?'received':'paid'):request.status,icon:request.status==='paid'?'checkmark-circle':'receipt-outline',txHash:request.txHash};
}
export const realTransactionService={
 async list(limit?:number){const userId=await requireUserId();const result=(await realPaymentService.getPaymentRequests()).map(r=>mapActivity(r,userId));return limit?result.slice(0,limit):result;},
 async get(id:string){return mapActivity(await realPaymentService.getPaymentRequest(id),await requireUserId());},
};
