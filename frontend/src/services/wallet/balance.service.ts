import {env} from '@/config/env';
import {walletService} from '@/services/wallet';
import {formatMinorUnits} from '@/lib/money';
import {walletMetadataService} from './wallet-metadata.service';
export const balanceService={
 async get(){
  const local=await walletService.getAccount();
  if(env.demoMode){return {address:local?.walletAddress??null,canSign:!!local,balance:await walletService.getBalance(),notice:undefined};}
  const registered=(await walletMetadataService.list()).filter(wallet=>wallet.status!=='disabled').sort((a,b)=>Number(b.is_default)-Number(a.is_default))[0];
  const address=registered?.contract_address??local?.walletAddress;
  if(!address)return {address:null,canSign:false,balance:null,notice:'Todavía no registraste una wallet.'};
  if(registered?.provider==='mock'){
   const remote=await walletMetadataService.getMockBalance(registered.id);
   const formatted=formatMinorUnits(remote.amount_minor,7);
   return {address,canSign:local?.walletAddress===address,balance:{walletAddress:address,assetCode:'USDC',amount:Number(formatted),formatted,funded:BigInt(remote.amount_minor)>0n},notice:undefined};
  }
  const balance=await walletService.getBalance(address);
  return {address,canSign:local?.walletAddress===address,balance,notice:undefined};
 },
};
