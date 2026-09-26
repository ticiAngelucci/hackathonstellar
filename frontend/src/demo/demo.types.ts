import type {PaymentPolicy,Transaction} from '@/types';
import type {PatoPayEvent} from '@/services/eventService';
import type {WalletAccount} from '@/services/wallet/types';
export type DemoRequest={id:string;amount:number;title:string;status:'pending'|'paid'|'rejected'|'blocked';txId?:string};
export type DemoState={balance:number;wallet:WalletAccount|null;groups:(PatoPayEvent & {balance:number})[];transactions:Transaction[];requests:DemoRequest[];subscriptions:Record<string,boolean>;policy:PaymentPolicy;staking:boolean;sequence:number;spent:number};
