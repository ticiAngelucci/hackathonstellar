import {demoAccount} from '@/demo/demo.data';
import {readDemoState,mutateDemo} from '@/demo/demo.controller';
import {demoWait,DEMO_TIMINGS} from '@/demo/demo.config';
import type {WalletService,CreateWalletInput,PreparePaymentInput,PreparedPayment,SignedPayment} from '@/services/wallet/wallet.service';
import {demoPaymentService} from './demo-payment.service';
export class DemoWalletService implements WalletService{
 readonly mode='mock' as const;
 async prepareWallet(){}
 async createWithPasskey(_input:CreateWalletInput){await demoWait(DEMO_TIMINGS.long);return mutateDemo(s=>s.wallet={...demoAccount});}
 async getAccount(){return (await readDemoState()).wallet;}
 async getBalance(){const s=await readDemoState();return {walletAddress:demoAccount.walletAddress,assetCode:'USDC',amount:s.balance,formatted:s.balance.toFixed(2),funded:true};}
 async fundTestnet(){await mutateDemo(s=>s.balance=Math.round((s.balance+100)*100)/100);return {address:demoAccount.address,network:'testnet' as const,txHash:'DEMO-FUND-PATO'};}
 async preparePayment(input:PreparePaymentInput){const amount=Number(input.amount);if(!Number.isFinite(amount)||amount<=0)throw new Error('Ingresá un monto válido.');const r=await demoPaymentService.create(amount);return {id:r.id,walletAddress:demoAccount.address,destination:input.destination,amount:amount.toFixed(2),assetCode:'USDC',network:'testnet' as const};}
 async signPayment(payment:PreparedPayment){return {...payment,signedXdr:'DEMO-NOT-A-TRANSACTION'};}
 async submitPayment(payment:SignedPayment){const tx=await demoPaymentService.pay(payment.id,true);if(!tx)throw new Error('Bloqueado por tus reglas.');return {...payment,txHash:tx.txHash!,status:'success' as const,explorerUrl:''};}
 async getTransactionStatus(txHash:string){const s=await readDemoState();return {txHash,status:s.transactions.some(t=>t.txHash===txHash)?'success' as const:'not_found' as const,explorerUrl:''};}
}
