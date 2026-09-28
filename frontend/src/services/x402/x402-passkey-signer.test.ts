import {ExactStellarScheme,isClientStellarSigner} from '@x402/stellar';
import {Address,Networks,StrKey,nativeToScVal,xdr} from '@stellar/stellar-sdk';
import {describe,expect,it,vi} from 'vitest';
import {createPasskeyKitStellarSigner,createPasskeyStellarSigner} from './x402-passkey-signer';

const USDC_TESTNET='CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';
const walletAddress=StrKey.encodeContract(Buffer.alloc(32,1));
const destination=StrKey.encodeContract(Buffer.alloc(32,2));
const otherAsset=StrKey.encodeContract(Buffer.alloc(32,3));
const otherDestination=StrKey.encodeContract(Buffer.alloc(32,4));
const requirements={
  scheme:'exact',
  network:'stellar:testnet',
  amount:'1000000',
  asset:USDC_TESTNET,
  payTo:destination,
  maxTimeoutSeconds:60,
  extra:{areFeesSponsored:true},
} as const;
const expectedPayment={asset:requirements.asset,amount:requirements.amount,payTo:requirements.payTo};

function transferAuthEntry({asset=USDC_TESTNET,amount='1000000',payTo=destination}:{asset?:string;amount?:string;payTo?:string}={}){
  return new xdr.SorobanAuthorizationEntry({
    credentials:xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address:Address.fromString(walletAddress).toScAddress(),
        nonce:xdr.Int64.fromString('1'),
        signatureExpirationLedger:0,
        signature:xdr.ScVal.scvVoid(),
      }),
    ),
    rootInvocation:new xdr.SorobanAuthorizedInvocation({
      function:xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
        new xdr.InvokeContractArgs({
          contractAddress:Address.fromString(asset).toScAddress(),
          functionName:'transfer',
          args:[
            nativeToScVal(walletAddress,{type:'address'}),
            nativeToScVal(payTo,{type:'address'}),
            nativeToScVal(amount,{type:'i128'}),
          ],
        }),
      ),
      subInvocations:[],
    }),
  });
}

describe('createPasskeyStellarSigner',()=>{
  it('exposes the contract address and delegates auth-entry signing',async()=>{
    const entry=transferAuthEntry();
    const signEntry=vi.fn(async(received:xdr.SorobanAuthorizationEntry)=>received);
    const signer=createPasskeyStellarSigner(walletAddress,signEntry);

    const result=await signer.signAuthEntry(entry.toXDR('base64'),{
      address:walletAddress,
      networkPassphrase:Networks.TESTNET,
    });

    expect(signer.address).toBe(walletAddress);
    expect(signEntry).toHaveBeenCalledOnce();
    expect(signEntry.mock.calls[0][0].toXDR('base64')).toBe(entry.toXDR('base64'));
    expect(result).toEqual({signedAuthEntry:entry.toXDR('base64'),signerAddress:walletAddress});
  });

  it('rejects an auth entry requested for another wallet',async()=>{
    const entry=transferAuthEntry();
    const signEntry=vi.fn(async(received:xdr.SorobanAuthorizationEntry)=>received);
    const signer=createPasskeyStellarSigner(walletAddress,signEntry);

    await expect(signer.signAuthEntry(entry.toXDR('base64'),{
      address:destination,
      networkPassphrase:Networks.TESTNET,
    })).rejects.toThrow('x402 intentó firmar con otra wallet.');
    expect(signEntry).not.toHaveBeenCalled();
  });

  it('rejects an auth entry requested for a non-Testnet network',async()=>{
    const entry=transferAuthEntry();
    const signEntry=vi.fn(async(received:xdr.SorobanAuthorizationEntry)=>received);
    const signer=createPasskeyStellarSigner(walletAddress,signEntry);

    await expect(signer.signAuthEntry(entry.toXDR('base64'),{
      address:walletAddress,
      networkPassphrase:Networks.PUBLIC,
    })).rejects.toThrow('x402 intentó firmar para otra red.');
    expect(signEntry).not.toHaveBeenCalled();
  });

  it('adapts PasskeyKit auth-entry signing to an x402 exact client',async()=>{
    const entry=transferAuthEntry();
    const kit={signAuthEntry:vi.fn(async(received:xdr.SorobanAuthorizationEntry)=>received)};
    const signer=createPasskeyKitStellarSigner(walletAddress,kit,expectedPayment);
    const scheme=new ExactStellarScheme(signer);

    expect(scheme.scheme).toBe(requirements.scheme);
    expect(scheme.findDefaultAsset(requirements.asset,requirements.network)?.asset).toBe(requirements.asset);
    expect(isClientStellarSigner(signer)).toBe(true);
    expect(signer.signTransaction).toBeUndefined();

    await signer.signAuthEntry(entry.toXDR('base64'),{
      address:walletAddress,
      networkPassphrase:Networks.TESTNET,
    });
    expect(kit.signAuthEntry).toHaveBeenCalledOnce();
    expect(kit.signAuthEntry.mock.calls[0][0].toXDR('base64')).toBe(entry.toXDR('base64'));
  });

  it('does not ask PasskeyKit to sign a transfer for another asset',async()=>{
    const entry=transferAuthEntry({asset:otherAsset});
    const kit={signAuthEntry:vi.fn(async(received:xdr.SorobanAuthorizationEntry)=>received)};
    const signer=createPasskeyKitStellarSigner(walletAddress,kit,expectedPayment);

    await expect(signer.signAuthEntry(entry.toXDR('base64'),{
      address:walletAddress,
      networkPassphrase:Networks.TESTNET,
    })).rejects.toThrow('La autorización x402 no coincide con el pago esperado.');
    expect(kit.signAuthEntry).not.toHaveBeenCalled();
  });

  it('does not ask PasskeyKit to sign a transfer for another amount',async()=>{
    const entry=transferAuthEntry({amount:'1000001'});
    const kit={signAuthEntry:vi.fn(async(received:xdr.SorobanAuthorizationEntry)=>received)};
    const signer=createPasskeyKitStellarSigner(walletAddress,kit,expectedPayment);

    await expect(signer.signAuthEntry(entry.toXDR('base64'),{
      address:walletAddress,
      networkPassphrase:Networks.TESTNET,
    })).rejects.toThrow('La autorización x402 no coincide con el pago esperado.');
    expect(kit.signAuthEntry).not.toHaveBeenCalled();
  });

  it('does not ask PasskeyKit to sign a transfer for another destination',async()=>{
    const entry=transferAuthEntry({payTo:otherDestination});
    const kit={signAuthEntry:vi.fn(async(received:xdr.SorobanAuthorizationEntry)=>received)};
    const signer=createPasskeyKitStellarSigner(walletAddress,kit,expectedPayment);

    await expect(signer.signAuthEntry(entry.toXDR('base64'),{
      address:walletAddress,
      networkPassphrase:Networks.TESTNET,
    })).rejects.toThrow('La autorización x402 no coincide con el pago esperado.');
    expect(kit.signAuthEntry).not.toHaveBeenCalled();
  });
});
