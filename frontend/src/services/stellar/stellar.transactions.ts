import {Api} from '@stellar/stellar-sdk/rpc';
import {getRpcClient} from '@/services/stellar/stellar.client';
import {stellarNetwork,transactionExplorerUrl} from '@/services/stellar/stellar.network';
import {getRelayerAuthHeaders} from '@/services/supabaseAuth';

export type RelayerSubmission={
  txHash:string;
  status:'success'|'pending';
  explorerUrl:string;
  transactionId?:string;
};

type RelayerPayload={
  success?:boolean;
  hash?:string;
  txHash?:string;
  transactionHash?:string;
  transactionId?:string;
  status?:string;
  error?:{message?:string}|string;
  message?:string;
};

export async function submitSignedTransaction(xdr:string):Promise<RelayerSubmission>{
  if(!stellarNetwork.relayerUrl)throw new Error('El relayer de Stellar no está configurado.');
  const authHeaders=await getRelayerAuthHeaders();

  const response=await fetch(stellarNetwork.relayerUrl,{
    method:'POST',
    headers:{Accept:'application/json','Content-Type':'application/json',...authHeaders},
    body:JSON.stringify({xdr,network:stellarNetwork.network}),
  });
  const payload=await response.json().catch(()=>null) as RelayerPayload|null;
  const failure=typeof payload?.error==='string'?payload.error:payload?.error?.message;
  if(!response.ok||payload?.success===false){
    throw new Error(failure??payload?.message??`El relayer rechazó la transacción (${response.status}).`);
  }

  const txHash=payload?.hash??payload?.txHash??payload?.transactionHash??'';
  if(!txHash&&!payload?.transactionId){
    throw new Error('El relayer no devolvió un hash ni un identificador de transacción.');
  }

  return {
    txHash,
    status:txHash?'success':'pending',
    explorerUrl:txHash?transactionExplorerUrl(txHash):stellarNetwork.explorerUrl,
    transactionId:payload?.transactionId,
  };
}

export async function getTransactionStatus(txHash:string){
  if(!/^[0-9a-f]{64}$/i.test(txHash)){
    return {status:'not_found' as const,txHash,explorerUrl:transactionExplorerUrl(txHash)};
  }
  const result=await getRpcClient().getTransaction(txHash);
  const status:'success'|'failed'|'pending'=result.status===Api.GetTransactionStatus.SUCCESS
    ?'success'
    :result.status===Api.GetTransactionStatus.FAILED
      ?'failed'
      :'pending';
  return {status,txHash,explorerUrl:transactionExplorerUrl(txHash)};
}
