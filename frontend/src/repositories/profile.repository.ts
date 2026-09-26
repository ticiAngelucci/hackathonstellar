import {apiRequest,PatoPayApiError} from '@/services/api/patopayApi';
import type {ApiProfile,ApiPublicProfile,ApiWallet} from '@/services/api/types';
import type {ProfileUpdate} from '@/types/domain';
import type {WalletAccount} from '@/services/wallet/types';
export const profileRepository={
 async get(_id:string){try{return await apiRequest<ApiProfile>('/api/v1/me');}catch(error){if(error instanceof PatoPayApiError&&error.status===404)return null;throw error;}},
 update(_id:string,input:ProfileUpdate){return apiRequest<ApiProfile>('/api/v1/me',{method:'PUT',body:JSON.stringify({display_name:input.displayName.trim(),username:input.username.trim().toLowerCase(),notifications_enabled:input.notificationsEnabled})});},
 lookup(username:string){return apiRequest<ApiPublicProfile>(`/api/v1/profiles?username=${encodeURIComponent(username.trim().toLowerCase().replace(/^@/,''))}`);},
 async wallets(_id:string){return (await apiRequest<ApiWallet[]>('/api/v1/me/wallets')).filter(w=>w.provider==='stellar'&&w.status!=='disabled');},
 async saveWallet(id:string,account:WalletAccount){
  if(account.signer!=='passkey'||account.status!=='active')return;
  if((await profileRepository.wallets(id)).some(w=>w.contract_address===account.walletAddress))return;
  await apiRequest<ApiWallet>('/api/v1/me/wallets',{method:'POST',body:JSON.stringify({provider:'stellar',network:account.network,contract_address:account.walletAddress,creation_tx_hash:account.creationTxHash??null,wallet_wasm_hash:null,status:'unverified',is_default:true})});
 },
};
