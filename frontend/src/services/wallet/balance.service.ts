import {DEMO_MODE} from '@/demo/demo.config';
import {walletService} from '@/services/wallet';
import {profileRepository} from '@/repositories/profile.repository';
import {requireUserId} from '@/services/auth/auth.service';
import {apiRequest,PatoPayApiError} from '@/services/api/patopayApi';
export const balanceService={
 async get(){
  if(DEMO_MODE){const account=await walletService.getAccount();return {address:account?.walletAddress??null,canSign:!!account,balance:await walletService.getBalance(),notice:undefined};}
  const wallet=(await profileRepository.wallets(await requireUserId()))[0];
  if(!wallet)return {address:null,canSign:false,balance:null,notice:'Todavía no registraste una wallet.'};
  try{await apiRequest(`/api/v1/me/wallets/${encodeURIComponent(wallet.id)}/balance`);}catch(error){if(!(error instanceof PatoPayApiError&&error.status===503))throw error;}
  // The current API has no Stellar balance adapter or financial execution contract.
  return {address:wallet.contract_address,canSign:false,balance:null,notice:'Balance Stellar todavía no disponible.'};
 },
};
