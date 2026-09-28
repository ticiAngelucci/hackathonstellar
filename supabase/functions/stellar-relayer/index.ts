import {Networks,TransactionBuilder} from 'npm:@stellar/stellar-sdk@16.3.0';
import {createClient} from 'npm:@supabase/supabase-js@2.116.0';
import {PasskeyServer} from 'npm:passkey-kit@0.19.1/server';

const rpcUrl=Deno.env.get('STELLAR_RPC_URL')??'https://soroban-testnet.stellar.org';
const relayerBaseUrl=Deno.env.get('STELLAR_RELAYER_BASE_URL')??'';
const relayerApiKey=Deno.env.get('STELLAR_RELAYER_API_KEY')??'';
const allowedOrigins=(Deno.env.get('PATOPAY_ALLOWED_ORIGINS')??'')
  .split(',')
  .map(value=>value.trim())
  .filter(Boolean);
const supabaseUrl=Deno.env.get('SUPABASE_URL')??'';
const supabaseKey=Deno.env.get('SUPABASE_ANON_KEY')??Deno.env.get('SUPABASE_PUBLISHABLE_KEY')??'';
const supabase=supabaseUrl&&supabaseKey?createClient(supabaseUrl,supabaseKey,{auth:{persistSession:false,autoRefreshToken:false}}):null;

const server=new PasskeyServer({
  networkPassphrase:Networks.TESTNET,
  rpcUrl,
  relayer:{baseUrl:relayerBaseUrl,apiKey:relayerApiKey,timeout:120_000},
});

function corsHeaders(request:Request){
  const origin=request.headers.get('origin');
  const allowedOrigin=!origin||allowedOrigins.includes(origin)?origin??'*':'null';
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

async function authenticate(request:Request){
  const origin=request.headers.get('origin');
  if(origin&&!allowedOrigins.includes(origin))return {status:403,message:'Origen no permitido.'};
  const authorization=request.headers.get('authorization')??'';
  const token=authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if(!token)return {status:401,message:'Se requiere una sesión autenticada.'};
  if(!supabase)return {status:503,message:'La verificación de sesión del relayer no está configurada.'};
  const {data,error}=await supabase.auth.getUser(token);
  if(error||!data.user)return {status:401,message:'La sesión del relayer no es válida.'};
  return {status:200,userId:data.user.id};
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
  const authentication=await authenticate(request);
  if(authentication.status!==200){
    return json(request,{success:false,error:{message:authentication.message}},authentication.status);
  }
  if(!relayerBaseUrl||!relayerApiKey){
    return json(request,{success:false,error:{message:'El relayer Testnet no está configurado en Supabase.'}},503);
  }

  try{
    const body=await request.json() as {xdr?:unknown;network?:unknown;purpose?:unknown};
    if(body.purpose!=='wallet_creation'||body.network!=='testnet'||typeof body.xdr!=='string'||!body.xdr){
      return json(request,{success:false,error:{message:'Sólo se acepta una creación de wallet firmada para Stellar Testnet.'}},400);
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
