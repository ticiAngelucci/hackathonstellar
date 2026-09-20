import {Horizon,rpc} from '@stellar/stellar-sdk';
import {stellarNetwork} from '@/services/stellar/stellar.network';

let horizonClient:Horizon.Server|undefined;
let rpcClient:rpc.Server|undefined;

export function getHorizonClient(){
  horizonClient??=new Horizon.Server(stellarNetwork.horizonUrl);
  return horizonClient;
}

export function getRpcClient(){
  rpcClient??=new rpc.Server(stellarNetwork.rpcUrl);
  return rpcClient;
}

export async function checkStellarConnection(){
  const response=await fetch(stellarNetwork.horizonUrl,{headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error(`Horizon no respondió correctamente (${response.status}).`);

  const health=await getRpcClient().getHealth();
  if(health.status!=='healthy')throw new Error('Stellar RPC no está saludable.');

  return {horizon:true,rpc:true,network:stellarNetwork.network} as const;
}
