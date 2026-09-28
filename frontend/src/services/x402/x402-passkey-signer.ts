import type {ClientStellarSigner} from '@x402/stellar';
import {Address,Networks,scValToNative,xdr} from '@stellar/stellar-sdk';

type SignEntry=(entry:xdr.SorobanAuthorizationEntry)=>Promise<xdr.SorobanAuthorizationEntry>;
type PasskeyAuthEntrySigner={signAuthEntry:SignEntry};
export type ExpectedStellarPayment={asset:string;amount:string;payTo:string};

const INTENT_MISMATCH='La autorización x402 no coincide con el pago esperado.';

function assertExpectedIntent(entry:xdr.SorobanAuthorizationEntry,expected:ExpectedStellarPayment){
  try{
    const authorizedFunction=entry.rootInvocation().function();
    if(authorizedFunction.switch().name!=='sorobanAuthorizedFunctionTypeContractFn')throw new Error(INTENT_MISMATCH);
    const invocation=authorizedFunction.contractFn();
    const asset=Address.fromScAddress(invocation.contractAddress()).toString();
    const payTo=String(scValToNative(invocation.args()[1]));
    const amount=String(scValToNative(invocation.args()[2]));
    if(asset!==expected.asset||payTo!==expected.payTo||amount!==expected.amount)throw new Error(INTENT_MISMATCH);
  }catch(error){
    if(error instanceof Error&&error.message===INTENT_MISMATCH)throw error;
    throw new Error(INTENT_MISMATCH);
  }
}

export function createPasskeyKitStellarSigner(address:string,kit:PasskeyAuthEntrySigner,expected?:ExpectedStellarPayment):ClientStellarSigner{
  return createPasskeyStellarSigner(address,entry=>kit.signAuthEntry(entry),expected);
}

export function createPasskeyStellarSigner(address:string,signEntry:SignEntry,expected?:ExpectedStellarPayment):ClientStellarSigner{
  return {
    address,
    async signAuthEntry(authEntry,options){
      if(options?.address&&options.address!==address){
        throw new Error('x402 intentó firmar con otra wallet.');
      }
      if(options?.networkPassphrase&&options.networkPassphrase!==Networks.TESTNET){
        throw new Error('x402 intentó firmar para otra red.');
      }
      const decoded=xdr.SorobanAuthorizationEntry.fromXDR(authEntry,'base64');
      if(expected)assertExpectedIntent(decoded,expected);
      const signed=await signEntry(decoded);
      return {signedAuthEntry:signed.toXDR('base64'),signerAddress:address};
    },
  };
}
