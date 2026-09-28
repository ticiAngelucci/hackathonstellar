import {appDatabase} from '@/lib/supabase';
import {AppError,checkResult} from '@/lib/errors';
import {minorUnitsToRpcNumber} from '@/lib/money';
import type {PaymentCreated,PaymentDecision,PaymentRecord,PaymentRepository} from '@/repositories/contracts';

async function hydrate(rows:Omit<PaymentRecord,'asset'>[]){
  if(!rows.length)return [];
  const assetIds=[...new Set(rows.map(row=>row.asset_id))];
  const {data:assets,error:assetError}=await appDatabase().from('assets').select('id,network,contract_address,code,decimals,enabled,created_at').in('id',assetIds);
  checkResult(assetError,'No pudimos cargar los activos de tus solicitudes.');
  const byAsset=new Map((assets??[]).map(asset=>[asset.id,asset]));
  return rows.map(row=>({...row,asset:byAsset.get(row.asset_id)}));
}

export const supabasePaymentRepository:PaymentRepository={
  async list(){
    const {data,error}=await appDatabase().from('payment_requests').select('id,requester_id,payer_id,source_wallet_id,destination_wallet_id,asset_id,amount_minor,memo,policy_version_id,policy_snapshot,status,version,created_at,updated_at').order('created_at',{ascending:false}).limit(100);
    checkResult(error,'No pudimos cargar tus solicitudes.');
    return hydrate((data??[]).map(row=>({...row,amount_minor:String(row.amount_minor)})));
  },
  async get(id){
    const {data,error}=await appDatabase().from('payment_requests').select('id,requester_id,payer_id,source_wallet_id,destination_wallet_id,asset_id,amount_minor,memo,policy_version_id,policy_snapshot,status,version,created_at,updated_at').eq('id',id).maybeSingle();
    checkResult(error,'No pudimos cargar la solicitud.');
    if(!data)throw new AppError('No encontramos esa solicitud.','not_found');
    return (await hydrate([{...data,amount_minor:String(data.amount_minor)}]))[0];
  },
  async create(input,key){
    const {data,error}=await appDatabase().rpc('create_payment_request',{p_payer_profile_id:input.payer_profile_id,p_amount_minor:minorUnitsToRpcNumber(input.amount_minor),p_asset_id:input.asset_id,p_memo:input.memo,p_idempotency_key:key});
    checkResult(error,'No pudimos crear la solicitud. Reintentá.');
    const created=data as unknown as PaymentCreated;
    return {...created,amount_minor:String(created.amount_minor)};
  },
  async decide(id,action,expectedVersion,key){
    const {data,error}=await appDatabase().rpc('decide_payment_request',{p_request_id:id,p_action:action,p_expected_version:expectedVersion,p_idempotency_key:key});
    checkResult(error,'No pudimos actualizar la solicitud.');
    return data as unknown as PaymentDecision;
  },
  async defaultAsset(){
    const {data,error}=await appDatabase().from('assets').select('*').eq('enabled',true).eq('code','USDC').order('created_at',{ascending:true}).limit(1).maybeSingle();
    checkResult(error,'No pudimos cargar el activo de pago.');
    if(!data)throw new AppError('No hay un activo USDC habilitado.','configuration');
    return data;
  },
};
