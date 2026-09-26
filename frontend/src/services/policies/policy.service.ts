import {policyRepository} from '@/repositories/policy.repository';
import {AppError} from '@/lib/errors';
import {formatMinorUnits,requireAssetId} from '@/services/api/money';
import type {PaymentPolicy} from '@/types';
import type {ApiPolicy} from '@/services/api/types';
export function mapPolicy(row:ApiPolicy):PaymentPolicy{
 // These numbers are display compatibility only. Writes use original string minorLimits.
 return {autoPayLimit:Number(formatMinorUnits(row.auto_pay_limit_minor)),approvalLimit:Number(formatMinorUnits(row.approval_limit_minor)),blockAbove:Number(formatMinorUnits(row.approval_limit_minor)),dailyLimit:Number(formatMinorUnits(row.daily_limit_minor)),allowedRecipientsOnly:row.recipient_mode==='allowlist',version:row.version,blockFollowsApproval:true,minorLimits:{auto:row.auto_pay_limit_minor,approval:row.approval_limit_minor,daily:row.daily_limit_minor},allowedRecipientIds:row.allowed_recipient_ids,allowedAssetIds:row.allowed_asset_ids,notice:'Reglas guardadas. La ejecución de pagos todavía no está habilitada.'};
}
export const realPolicyService={
 async get():Promise<PaymentPolicy>{const row=await policyRepository.latest();return row?mapPolicy(row):{autoPayLimit:0,approvalLimit:0,blockAbove:0,dailyLimit:0,allowedRecipientsOnly:true,version:0,minorLimits:{auto:'0',approval:'0',daily:'0'},allowedRecipientIds:[],allowedAssetIds:[],blockFollowsApproval:true,notice:'Todavía no guardaste reglas. Configurá los límites antes de crear solicitudes.'};},
 async save(policy:PaymentPolicy){
  const limits=policy.minorLimits;
  if(!limits||!Object.values(limits).every(v=>/^(0|[1-9]\d*)$/.test(v)))throw new AppError('Ingresá límites válidos.');
  if(BigInt(limits.auto)>BigInt(limits.approval)||BigInt(limits.daily)<1n)throw new AppError('El límite automático no puede superar el de aprobación. El diario debe ser positivo.');
  if(policy.version===undefined)throw new AppError('Actualizá tus reglas antes de guardar.');
  const assets=policy.allowedAssetIds?.length?policy.allowedAssetIds:[requireAssetId()];
  return mapPolicy(await policyRepository.create({expected_version:policy.version,auto_pay_limit_minor:limits.auto,approval_limit_minor:limits.approval, daily_limit_minor:limits.daily,recipient_mode:policy.allowedRecipientsOnly?'allowlist':'any',allowed_recipient_ids:policy.allowedRecipientIds??[],allowed_asset_ids:assets}));
 },
};
