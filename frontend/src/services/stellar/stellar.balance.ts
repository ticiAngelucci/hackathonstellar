import {SACClient} from 'passkey-kit';
import {StrKey} from '@stellar/stellar-sdk';
import {getHorizonClient} from '@/services/stellar/stellar.client';
import {stellarNetwork} from '@/services/stellar/stellar.network';

export type StellarBalance={
  address:string;
  assetCode:string;
  baseUnits:bigint;
  amount:number;
  formatted:string;
  funded:boolean;
};

function formatBaseUnits(baseUnits:bigint,decimals:number){
  const negative=baseUnits<0n;
  const absolute=negative?-baseUnits:baseUnits;
  const divisor=10n**BigInt(decimals);
  const integer=absolute/divisor;
  const fraction=(absolute%divisor).toString().padStart(decimals,'0').replace(/0+$/,'');
  return `${negative?'-':''}${integer}${fraction?`.${fraction}`:''}`;
}

function fromBaseUnits(baseUnits:bigint,decimals:number,address:string):StellarBalance{
  const formatted=formatBaseUnits(baseUnits,decimals);
  return {
    address,
    assetCode:stellarNetwork.assetCode,
    baseUnits,
    amount:Number(formatted),
    formatted,
    funded:baseUnits>0n,
  };
}

async function getContractBalance(address:string){
  const sac=new SACClient({
    rpcUrl:stellarNetwork.rpcUrl,
    networkPassphrase:stellarNetwork.networkPassphrase,
  }).getSACClient(stellarNetwork.assetContractId);
  const [{result:baseUnits},{result:decimals}]=await Promise.all([
    sac.balance({id:address}),
    sac.decimals(),
  ]);
  return fromBaseUnits(baseUnits,decimals,address);
}

async function getClassicAccountBalance(address:string){
  try{
    const account=await getHorizonClient().loadAccount(address);
    const balance=account.balances.find(item=>{
      if(stellarNetwork.assetCode==='XLM')return item.asset_type==='native';
      return (item.asset_type==='credit_alphanum4'||item.asset_type==='credit_alphanum12')
        &&item.asset_code===stellarNetwork.assetCode;
    });
    const amount=balance?.balance??'0';
    const baseUnits=BigInt(Math.round(Number(amount)*10**stellarNetwork.assetDecimals));
    return fromBaseUnits(baseUnits,stellarNetwork.assetDecimals,address);
  }catch(error){
    const status=(error as {response?:{status?:number}})?.response?.status;
    if(status===404)return fromBaseUnits(0n,stellarNetwork.assetDecimals,address);
    throw error;
  }
}

export async function getBalance(address:string){
  if(StrKey.isValidContract(address))return getContractBalance(address);
  if(StrKey.isValidEd25519PublicKey(address))return getClassicAccountBalance(address);
  throw new Error('La dirección Stellar no es válida.');
}

export async function fundWithFriendbot(address:string){
  if(!StrKey.isValidEd25519PublicKey(address)&&!StrKey.isValidContract(address)){
    throw new Error('La dirección Stellar no es válida.');
  }

  const url=`${stellarNetwork.friendbotUrl}?addr=${encodeURIComponent(address)}`;
  const response=await fetch(url,{headers:{Accept:'application/json'}});
  const payload=await response.json().catch(()=>null) as {hash?:string;detail?:string}|null;

  if(!response.ok){
    throw new Error(payload?.detail??`Friendbot rechazó el fondeo (${response.status}).`);
  }

  return {txHash:payload?.hash,network:stellarNetwork.network,address};
}
