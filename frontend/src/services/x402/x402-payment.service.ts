import {wrapFetchWithPayment,x402Client} from '@x402/fetch';
import {ExactStellarScheme} from '@x402/stellar';
import {AppError} from '@/lib/errors';
import {PatoPayApiError,getApiUrl} from '@/services/api/patopayApi';
import {authService} from '@/services/auth/auth.service';
import {getConnectedPasskeySigner} from '@/services/wallet/stellar-wallet.service';
import {stellarNetwork} from '@/services/stellar/stellar.network';

function createAttemptId(){
  const randomUUID=globalThis.crypto?.randomUUID;
  if(!randomUUID)throw new AppError('Este dispositivo no puede crear un identificador seguro para el intento.','configuration');
  return randomUUID();
}

async function createPaymentFetch(){
  const signer=await getConnectedPasskeySigner();
  const scheme=new ExactStellarScheme(signer,{url:stellarNetwork.rpcUrl});
  const client=new x402Client().register('stellar:testnet',scheme);
  return wrapFetchWithPayment(async(input,init={})=>{
    const session=await authService.getSession();
    if(!session)throw new PatoPayApiError(401);
    const headers=new Headers(init.headers);
    headers.set('Accept','application/json');
    headers.set('Authorization',`Bearer ${session.access_token}`);
    headers.set('apikey',process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim()||process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()||'');
    if(init.body)headers.set('Content-Type','application/json');
    return fetch(input,{...init,headers});
  },client);
}

export async function settlePaymentRequest(requestId:string,expectedVersion:number,attemptId=createAttemptId()){
  const fetchWithPayment=await createPaymentFetch();
  const response=await fetchWithPayment(`${getApiUrl()}/api/v1/payment-requests/${encodeURIComponent(requestId)}/settle`,{
    method:'POST',
    headers:{'Idempotency-Key':`payment-settlement:${requestId}:${attemptId}`},
    body:JSON.stringify({expected_version:expectedVersion,attempt_id:attemptId}),
  });
  const payload=await response.json().catch(()=>null) as {status?:string;attempt_id?:string;tx_hash?:string;next_action?:string}|null;
  if(!response.ok){throw new PatoPayApiError(response.status);}
  return payload;
}
