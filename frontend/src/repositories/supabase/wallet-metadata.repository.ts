import {appDatabase} from '@/lib/supabase';
import {AppError,checkResult} from '@/lib/errors';
import type {WalletMetadataRepository} from '@/repositories/contracts';

const fields='id,user_id,provider,network,contract_address,wallet_wasm_hash,creation_tx_hash,status,is_default,version,created_at,updated_at';

export const supabaseWalletMetadataRepository:WalletMetadataRepository={
  async list(userId){
    const {data,error}=await appDatabase().from('wallets').select(fields).eq('user_id',userId).order('created_at',{ascending:true}).order('id',{ascending:true});
    checkResult(error,'No pudimos cargar tus wallets.');
    return data??[];
  },
  async get(id,userId){
    const {data,error}=await appDatabase().from('wallets').select(fields).eq('id',id).eq('user_id',userId).maybeSingle();
    checkResult(error,'No pudimos cargar esa wallet.');
    if(!data)throw new AppError('No encontramos esa wallet.','not_found');
    return data;
  },
  async create(userId,input){
    const {data,error}=await appDatabase().from('wallets').insert({...input,user_id:userId,status:'unverified',version:1}).select(fields).single();
    checkResult(error,'No pudimos registrar tu wallet.');
    return data!;
  },
  async disable(id,userId,expectedVersion){
    const {data,error}=await appDatabase().from('wallets').update({status:'disabled',version:expectedVersion+1,updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',userId).eq('version',expectedVersion).select('id').maybeSingle();
    checkResult(error,'No pudimos desactivar tu wallet.');
    if(!data)throw new AppError('La wallet cambió. Actualizá y reintentá.','conflict');
  },
  async balance(id){
    const {data,error}=await appDatabase().from('mock_wallet_balances').select('wallet_id,balance_minor,observed_at').eq('wallet_id',id).maybeSingle();
    checkResult(error,'No pudimos cargar el saldo de tu wallet.');
    return {wallet_id:id,asset_id:null,amount_minor:String(data?.balance_minor??0),observed_at:data?.observed_at??'',ledger:null,mode:'mock'};
  },
};
