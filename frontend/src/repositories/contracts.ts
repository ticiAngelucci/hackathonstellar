import type {ProfileUpdate,PatoPayEvent} from '@/types/domain';
import type {ProfileRow,WalletRow,PaymentPolicyRow,PaymentRequestRow,AssetRow,ServiceSubscriptionRow} from '@/types/database.generated';

export type PublicProfileRecord=Pick<ProfileRow,'id'|'username'|'display_name'>;
export interface ProfileRepository{
  get(id:string):Promise<ProfileRow|null>;
  update(id:string,input:ProfileUpdate):Promise<ProfileRow>;
  lookup(username:string):Promise<PublicProfileRecord>;
}

export interface GroupRepository{
  list():Promise<PatoPayEvent[]>;
  get(id:string):Promise<PatoPayEvent>;
  create(name:string):Promise<PatoPayEvent>;
  update(id:string,name:string,version:number):Promise<PatoPayEvent>;
  members(id:string):Promise<PatoPayEvent['participants']>;
}

export type PaymentRecord=Omit<PaymentRequestRow,'amount_minor'>&{amount_minor:string;asset?:AssetRow};
export type PaymentCreated={id:string;status:PaymentRequestRow['status'];amount_minor:string;asset_id:string;policy_outcome:string;reason_code:string;next_action:string|null};
export type PaymentDecision={id:string;status:PaymentRequestRow['status'];version:number;next_action:string|null};
export interface PaymentRepository{
  list():Promise<PaymentRecord[]>;
  get(id:string):Promise<PaymentRecord>;
  create(input:{payer_profile_id:string;amount_minor:string;asset_id:string;memo:string|null},key:string):Promise<PaymentCreated>;
  decide(id:string,action:'approve'|'reject',expectedVersion:number,key:string):Promise<PaymentDecision>;
  defaultAsset():Promise<AssetRow>;
}

export type PolicyRecord=Pick<PaymentPolicyRow,'id'|'version'|'recipient_mode'>&{auto_pay_limit_minor:string;approval_limit_minor:string;daily_limit_minor:string;allowed_recipient_ids:string[];allowed_asset_ids:string[]};
export type PolicyWrite={expected_version:number;auto_pay_limit_minor:string;approval_limit_minor:string;daily_limit_minor:string;recipient_mode:'any'|'allowlist';allowed_recipient_ids:string[];allowed_asset_ids:string[]};
export interface PolicyRepository{
  latest():Promise<PolicyRecord|null>;
  create(input:PolicyWrite):Promise<PolicyRecord>;
}

export type ServiceId='electricity'|'internet'|'water'|'spotify'|'netflix'|'chatgpt'|'drive';
export interface SubscriptionRepository{
  list(userId:string):Promise<ServiceSubscriptionRow[]>;
  set(userId:string,serviceId:ServiceId,enabled:boolean):Promise<ServiceSubscriptionRow>;
}

export type WalletCreateRecord=Pick<WalletRow,'provider'|'network'|'contract_address'|'wallet_wasm_hash'|'creation_tx_hash'|'is_default'>;
export type WalletBalanceRecord={wallet_id:string;asset_id:null;amount_minor:string;observed_at:string;ledger:null;mode:'mock'};
export interface WalletMetadataRepository{
  list(userId:string):Promise<WalletRow[]>;
  get(id:string,userId:string):Promise<WalletRow>;
  create(userId:string,input:WalletCreateRecord):Promise<WalletRow>;
  disable(id:string,userId:string,expectedVersion:number):Promise<void>;
  balance(id:string):Promise<WalletBalanceRecord>;
}