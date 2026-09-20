import {Networks,TransactionBuilder} from 'npm:@stellar/stellar-sdk@16.3.0';
import {PasskeyServer} from 'npm:passkey-kit@0.19.1/server';

const rpcUrl=Deno.env.get('STELLAR_RPC_URL')??'https://soroban-testnet.stellar.org';
const relayerBaseUrl=Deno.env.get('STELLAR_RELAYER_BASE_URL')??'';
const relayerApiKey=Deno.env.get('STELLAR_RELAYER_API_KEY')??'';
const allowedOrigins=(Deno.env.get('PATOPAY_ALLOWED_ORIGINS')??'')
  .split(',')
  .map(value=>value.trim())
  .filter(Boolean);

const server=new PasskeyServer({
  networkPassphrase:Networks.TESTNET,
  rpcUrl,
  relayer:{baseUrl:relayerBaseUrl,apiKey:relayerApiKey,timeout:120_000},
});

function corsHeaders(request:Request){
  const origin=request.headers.get('origin');
  const allowedOrigin=!origin||allowedOrigins.length===0||allowedOrigins.includes(origin)?origin??'*':'null';
  return {
    'Access-Control-Allow-Origin':allowedOrigin,
    'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods':'POST, OPTIONS',
    'Content-Type':'application/json',
    'Vary':'Origin',
  };
}

function json(request:Request,body:unknown,status=200){
  return new Response(JSON.stringify(body),{status,headers:corsHeaders(request)});
}

function validateSignedXdr(xdr:string){
  if(xdr.length>100_000)throw new Error('El XDR excede el tamaño permitido.');
  const transaction=TransactionBuilder.fromXDR(xdr,Networks.TESTNET);
  if(transaction.operations.length!==1||transaction.operations[0]?.type!=='invokeHostFunction'){
    throw new Error('Sólo se acepta una operación Soroban por solicitud.');
  }
}

Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:corsHeaders(request)});
  if(request.method!=='POST')return json(request,{success:false,error:{message:'Método no permitido.'}},405);
  if(!relayerBaseUrl||!relayerApiKey){
    return json(request,{success:false,error:{message:'El relayer Testnet no está configurado en Supabase.'}},503);
  }

  try{
    const body=await request.json() as {xdr?:unknown;network?:unknown};
    if(body.network!=='testnet'||typeof body.xdr!=='string'||!body.xdr){
      return json(request,{success:false,error:{message:'Se requiere un XDR válido para Stellar Testnet.'}},400);
    }
    validateSignedXdr(body.xdr);

    const result=await server.send(body.xdr);
    if(!result.success){
      return json(request,{
        success:false,
        hash:result.hash,
        error:{code:result.error.code,message:result.error.message},
      },422);
    }

    return json(request,{
      success:true,
      hash:result.hash,
      ledger:result.ledger,
      transactionId:result.transactionId,
    });
  }catch(error){
    return json(request,{
      success:false,
      error:{message:error instanceof Error?error.message:'No se pudo enviar la transacción.'},
    },400);
  }
});
