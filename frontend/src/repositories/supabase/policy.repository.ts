import {appDatabase} from '@/lib/supabase';
import {checkResult} from '@/lib/errors';
import {minorUnitsToRpcNumber} from '@/lib/money';
import type {PolicyRecord,PolicyRepository} from '@/repositories/contracts';

function normalize(policy:Omit<PolicyRecord,'auto_pay_limit_minor'|'approval_limit_minor'|'daily_limit_minor'>&{auto_pay_limit_minor:string|number;approval_limit_minor:string|number;daily_limit_minor:string|number}):PolicyRecord{
  return {...policy,auto_pay_limit_minor:String(policy.auto_pay_limit_minor),approval_limit_minor:String(policy.approval_limit_minor),daily_limit_minor:String(policy.daily_limit_minor)};
}

async function additions(policy:{id:string}){
  const [{data:recipients,error:recipientError},{data:assets,error:assetError}]=await Promise.all([
    appDatabase().from('policy_allowed_recipients').select('recipient_profile_id').eq('policy_version_id',policy.id),
    appDatabase().from('policy_allowed_assets').select('asset_id').eq('policy_version_id',policy.id),
  ]);
  checkResult(recipientError,'No pudimos cargar los destinatarios permitidos.');
  checkResult(assetError,'No pudimos cargar los activos permitidos.');
  return {allowed_recipient_ids:(recipients??[]).map(item=>item.recipient_profile_id),allowed_asset_ids:(assets??[]).map(item=>item.asset_id)};
}

export const supabasePolicyRepository:PolicyRepository={
  async latest(){
    const {data,error}=await appDatabase().from('payment_policy_versions').select('id,version,auto_pay_limit_minor,approval_limit_minor,daily_limit_minor,recipient_mode').order('version',{ascending:false}).limit(1).maybeSingle();
    checkResult(error,'No pudimos cargar tus reglas.');
    if(!data)return null;
    return normalize({...data,...await additions(data)});
  },
  async create(input){
    const {data,error}=await appDatabase().rpc('replace_payment_policy',{p_auto_pay_limit_minor:minorUnitsToRpcNumber(input.auto_pay_limit_minor),p_approval_limit_minor:minorUnitsToRpcNumber(input.approval_limit_minor),p_daily_limit_minor:minorUnitsToRpcNumber(input.daily_limit_minor),p_recipient_mode:input.recipient_mode,p_allowed_recipient_ids:input.allowed_recipient_ids,p_allowed_asset_ids:input.allowed_asset_ids,p_expected_version:input.expected_version});
    checkResult(error,'No pudimos guardar tus reglas. Actualizá y reintentá.');
    return normalize(data as unknown as PolicyRecord);
  },
};
