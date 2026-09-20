import {PaymentPolicy,Transaction,TransactionStatus} from '@/types';
import {supabaseRequest,SupabaseError} from '@/services/supabaseClient';

const currentUserId=process.env.EXPO_PUBLIC_PATOPAY_USER_ID??'11111111-1111-4111-8111-111111111111';
const userFilter=encodeURIComponent(currentUserId);

type WalletRow={balance:number|string;asset:string};
type TransactionRow={
  id:string;
  title:string;
  subtitle:string|null;
  amount:number|string;
  status:TransactionStatus;
  icon:string;
  tx_hash:string|null;
  created_at:string;
};
type SubscriptionRow={service_id:string;enabled:boolean};
type PolicyRow={
  auto_pay_limit:number|string;
  approval_limit:number|string;
  block_above:number|string;
  daily_limit:number|string;
  allowed_recipients_only:boolean;
};

export const defaultPaymentPolicy:PaymentPolicy={
  autoPayLimit:5,
  approvalLimit:30,
  blockAbove:30,
  dailyLimit:50,
  allowedRecipientsOnly:true,
};

function asNumber(value:number|string){
  const parsed=Number(value);
  return Number.isFinite(parsed)?parsed:0;
}

function toTransaction(row:TransactionRow):Transaction{
  return {
    id:row.id,
    title:row.title,
    subtitle:row.subtitle??new Date(row.created_at).toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short'}),
    amount:asNumber(row.amount),
    status:row.status,
    icon:row.icon,
    txHash:row.tx_hash??undefined,
  };
}

export const walletService={
  async getBalance(){
    const rows=await supabaseRequest<WalletRow[]>(`/wallets?select=balance,asset&user_id=eq.${userFilter}&limit=1`);
    return rows[0]?asNumber(rows[0].balance):0;
  },
};

export const transactionService={
  async list(limit?:number){
    const suffix=limit?`&limit=${limit}`:'';
    const rows=await supabaseRequest<TransactionRow[]>(`/transactions?select=id,title,subtitle,amount,status,icon,tx_hash,created_at&user_id=eq.${userFilter}&order=created_at.desc${suffix}`);
    return rows.map(toTransaction);
  },
  async get(id:string){
    const rows=await supabaseRequest<TransactionRow[]>(`/transactions?select=id,title,subtitle,amount,status,icon,tx_hash,created_at&id=eq.${encodeURIComponent(id)}&user_id=eq.${userFilter}&limit=1`);
    const row=rows[0];
    if(!row)throw new SupabaseError('La transacción no existe o no tenés acceso.',404);
    return toTransaction(row);
  },
};

export const subscriptionService={
  async list(){
    const rows=await supabaseRequest<SubscriptionRow[]>(`/service_subscriptions?select=service_id,enabled&user_id=eq.${userFilter}`);
    return new Map(rows.map(row=>[row.service_id,row.enabled]));
  },
  async set(serviceId:string,enabled:boolean){
    const rows=await supabaseRequest<SubscriptionRow[]>('/service_subscriptions?on_conflict=user_id,service_id&select=service_id,enabled',{
      method:'POST',
      headers:{Prefer:'resolution=merge-duplicates,return=representation'},
      body:JSON.stringify({user_id:currentUserId,service_id:serviceId,enabled,updated_at:new Date().toISOString()}),
    });
    const saved=rows[0];
    if(!saved)throw new SupabaseError('Supabase no confirmó el cambio del servicio.');
    return saved.enabled;
  },
};

function toPolicy(row:PolicyRow):PaymentPolicy{
  return {
    autoPayLimit:asNumber(row.auto_pay_limit),
    approvalLimit:asNumber(row.approval_limit),
    blockAbove:asNumber(row.block_above),
    dailyLimit:asNumber(row.daily_limit),
    allowedRecipientsOnly:row.allowed_recipients_only,
  };
}

export const policyService={
  async get(){
    const rows=await supabaseRequest<PolicyRow[]>(`/payment_policies?select=auto_pay_limit,approval_limit,block_above,daily_limit,allowed_recipients_only&user_id=eq.${userFilter}&limit=1`);
    return rows[0]?toPolicy(rows[0]):defaultPaymentPolicy;
  },
  async save(policy:PaymentPolicy){
    const rows=await supabaseRequest<PolicyRow[]>('/payment_policies?on_conflict=user_id&select=auto_pay_limit,approval_limit,block_above,daily_limit,allowed_recipients_only',{
      method:'POST',
      headers:{Prefer:'resolution=merge-duplicates,return=representation'},
      body:JSON.stringify({
        user_id:currentUserId,
        auto_pay_limit:policy.autoPayLimit,
        approval_limit:policy.approvalLimit,
        block_above:policy.blockAbove,
        daily_limit:policy.dailyLimit,
        allowed_recipients_only:policy.allowedRecipientsOnly,
        updated_at:new Date().toISOString(),
      }),
    });
    if(!rows[0])throw new SupabaseError('Supabase no confirmó las reglas.');
    return toPolicy(rows[0]);
  },
};
