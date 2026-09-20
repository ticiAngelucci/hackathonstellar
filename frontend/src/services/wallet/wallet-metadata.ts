import AsyncStorage from '@react-native-async-storage/async-storage';
import type {WalletAccount} from '@/services/wallet/types';

const WALLET_METADATA_KEY='patopay:wallet:public-metadata:v1';

export async function getWalletMetadata(){
  const raw=await AsyncStorage.getItem(WALLET_METADATA_KEY);
  if(!raw)return null;
  try{
    return JSON.parse(raw) as WalletAccount;
  }catch{
    return null;
  }
}

export function saveWalletMetadata(account:WalletAccount){
  return AsyncStorage.setItem(WALLET_METADATA_KEY,JSON.stringify(account));
}
