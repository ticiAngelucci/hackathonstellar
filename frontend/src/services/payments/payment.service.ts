import {paymentRepository} from '@/repositories/payment.repository';
import {requireUserId} from '@/services/auth/auth.service';
import {AppError} from '@/lib/errors';
import {requireUsdcAsset} from '@/services/assets/asset.service';
import {decimalToMinorUnits,formatMinorUnits,configuredAssetId} from '@/services/api/money';
import type {ApiPaymentRequest} from '@/services/api/types';
import type {PaymentRequest,CreatePaymentRequest} from '@/types/domain';
export function mapRequest(row:ApiPaymentRequest):PaymentRequest{
 const knownAsset=row.asset_id===configuredAssetId();
 return {id:row.id,requesterId:row.requester_id,payerId:row.payer_id,assetId:row.asset_id,amount:knownAsset?formatMinorUnits(row.amount_minor):'—',asset:knownAsset?'USDC':'Activo sin configurar',concept:row.memo||'Solicitud de pago',status:row.status==='pending_approval'?'pending':row.status,version:row.version};
}
export const realPaymentService={
 async getPaymentRequests(){return (await paymentRepository.list(await requireUserId())).map(mapRequest);},
 async getPaymentRequest(id:string){return mapRequest(await paymentRepository.get(id,await requireUserId()));},
 async createPaymentRequest(input:CreatePaymentRequest){
  if(input.payerId===await requireUserId())throw new AppError('Elegí otra persona para pedirle un pago.');
  if(input.concept.length>500)throw new AppError('El concepto admite hasta 500 caracteres.');
  const amount=decimalToMinorUnits(input.amount);
  if(BigInt(amount)<=0n)throw new AppError('El monto debe ser mayor que cero.');
  if(!input.idempotencyKey||input.idempotencyKey.length>128)throw new AppError('No pudimos identificar esta solicitud.');
  const asset=await requireUsdcAsset();
  return paymentRepository.create({payer_profile_id:input.payerId,asset_id:asset.id,amount_minor:amount,memo:input.concept.trim()||null},input.idempotencyKey);
 },
 async approvePaymentRequest(id:string){
  const request=await this.getPaymentRequest(id);
  if(request.version===undefined)throw new AppError('La solicitud no tiene versión para aprobarse de forma segura.','configuration');
  return paymentRepository.decide(id,'approve',request.version,`payment-decision:approve:${id}:${request.version}`);
 },
 async rejectPaymentRequest(id:string){
  const request=await this.getPaymentRequest(id);
  if(request.version===undefined)throw new AppError('La solicitud no tiene versión para rechazarse de forma segura.','configuration');
  return paymentRepository.decide(id,'reject',request.version,`payment-decision:reject:${id}:${request.version}`);
 },
};
