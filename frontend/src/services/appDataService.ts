import {DEMO_MODE} from '@/demo/demo.config';
import {DemoWalletService} from '@/services/demo/demo-wallet.service';
import {demoTransactionService,demoSubscriptionService} from '@/services/demo/demo-payment.service';
import {demoPolicyService} from '@/services/demo/demo-policy.service';
import {PaymentPolicy,Transaction} from '@/types';
export const defaultPaymentPolicy:PaymentPolicy={
  autoPayLimit:5,
  approvalLimit:30,
  blockAbove:30,
  dailyLimit:50,
  allowedRecipientsOnly:true,
};

export const walletService=DEMO_MODE?{async getBalance(){return (await new DemoWalletService().getBalance()).amount;}}:{async getBalance(){const {getSupabase}=require('@/lib/supabase');getSupabase();const {balanceService}=require('@/services/wallet/balance.service');const balance=(await balanceService.get()).balance;if(!balance)throw new Error('Balance no disponible');return balance.amount;}};
export const transactionService:{list(limit?:number):Promise<Transaction[]>;get(id:string):Promise<Transaction>}=DEMO_MODE?demoTransactionService:require('@/services/transactions/transaction.service').realTransactionService;
export const subscriptionService:{list():Promise<Map<string,boolean>>;set(id:string,enabled:boolean):Promise<boolean>}=DEMO_MODE?demoSubscriptionService:require('@/services/services/automatic-services.service').realSubscriptionService;
export const policyService:{get():Promise<PaymentPolicy>;save(policy:PaymentPolicy):Promise<PaymentPolicy>}=DEMO_MODE?demoPolicyService:require('@/services/policies/policy.service').realPolicyService;
