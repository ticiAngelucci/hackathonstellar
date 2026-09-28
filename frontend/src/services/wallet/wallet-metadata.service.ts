import {walletMetadataRepository} from '@/repositories/wallet-metadata.repository';
import {requireUserId} from '@/services/auth/auth.service';
import type {WalletAccount} from './types';

export const walletMetadataService={
  async list(){return walletMetadataRepository.list(await requireUserId());},
  async get(id:string){return walletMetadataRepository.get(id,await requireUserId());},
  async registerAccount(account:WalletAccount){
    const userId=await requireUserId();
    const existing=(await walletMetadataRepository.list(userId)).find(wallet=>wallet.contract_address===account.walletAddress&&wallet.status!=='disabled');
    if(existing)return existing;
    return walletMetadataRepository.create(userId,{provider:account.signer==='mock'?'mock':'stellar',network:account.network,contract_address:account.walletAddress,wallet_wasm_hash:null,creation_tx_hash:account.creationTxHash??null,is_default:true});
  },
  async disable(id:string,expectedVersion:number){return walletMetadataRepository.disable(id,await requireUserId(),expectedVersion);},
  async getMockBalance(id:string){return walletMetadataRepository.balance(id);},
};
