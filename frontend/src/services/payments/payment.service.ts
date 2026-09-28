import {paymentRepository} from '@/repositories/payment.repository';
import {requireUserId} from '@/services/auth/auth.service';
import {AppError} from '@/lib/errors';
import {decimalToMinorUnits,formatMinorUnits} from '@/lib/money';
import type {PaymentRecord} from '@/repositories/contracts';
import type {PaymentRequest,CreatePaymentRequest} from '@/types/domain';
export function mapRequest(row:PaymentRecord):PaymentRequest{
 const status=row.status==='pending_approval'?'pending':row.status;
 return {id:row.id,requesterId:row.requester_id,payerId:row.payer_id,assetId:row.asset_id,amount:row.asset?formatMinorUnits(row.amount_minor,row.asset.decimals):'—',asset:row.asset?.code??'Activo sin configurar',concept:row.memo||'Solicitud de pago',status,createdAt:row.created_at,updatedAt:row.updated_at,version:row.version};
}
export const paymentService={
 async getPaymentRequests(){await requireUserId();return (await paymentRepository.list()).map(mapRequest);},
 async getPaymentRequest(id:string){await requireUserId();return mapRequest(await paymentRepository.get(id));},
 async createPaymentRequest(input:CreatePaymentRequest){
  if(input.payerId===await requireUserId())throw new AppError('Elegí otra persona para pedirle un pago.');
  if(input.concept.length>500)throw new AppError('El concepto admite hasta 500 caracteres.');
  const asset=await paymentRepository.defaultAsset();
  const amount=decimalToMinorUnits(input.amount,asset.decimals);
  if(BigInt(amount)<=0n)throw new AppError('El monto debe ser mayor que cero.');
  if(!input.idempotencyKey||input.idempotencyKey.length>128)throw new AppError('No pudimos identificar esta solicitud.');
  return paymentRepository.create({payer_profile_id:input.payerId,asset_id:asset.id,amount_minor:amount,memo:input.concept.trim()||null},input.idempotencyKey);
 },
 async approvePaymentRequest(_id:string):Promise<never>{throw new AppError('La aprobación de solicitudes todavía no está habilitada. No se movió tu saldo.','unsupported');},
 async rejectPaymentRequest(_id:string):Promise<never>{throw new AppError('El rechazo de solicitudes todavía no está habilitado.','unsupported');},
};
