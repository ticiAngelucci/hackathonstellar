import {PasskeyKit,SACClient} from 'passkey-kit';
import type {AssembledTransaction} from '@stellar/stellar-sdk/contract';
import {StrKey} from '@stellar/stellar-sdk';
import {ensureStellarRuntime} from '@/polyfills/stellar';
import {getBalance as getStellarBalance,fundWithFriendbot} from '@/services/stellar/stellar.balance';
import {checkStellarConnection} from '@/services/stellar/stellar.client';
import {assertStellarConfiguration,stellarNetwork} from '@/services/stellar/stellar.network';
import {getTransactionStatus as getStellarTransactionStatus,submitSignedTransaction} from '@/services/stellar/stellar.transactions';
import {AsyncStoragePasskeyAdapter} from '@/services/wallet/passkey-storage';
import {getPasskeyClient,isNativePasskeySupported} from '@/services/wallet/passkey.client';
import {getWalletMetadata,saveWalletMetadata} from '@/services/wallet/wallet-metadata';
import type {
  CreateWalletInput,
  PreparedPayment,
  PreparePaymentInput,
  SignedPayment,
  WalletAccount,
  WalletService,
} from '@/services/wallet/wallet.service';

const publicPasskeyStorage=new AsyncStoragePasskeyAdapter();

let kitPromise:Promise<PasskeyKit>|null=null;

async function getPasskeyKit(){
  if(!kitPromise){
    kitPromise=(async()=>{
      await ensureStellarRuntime();
      const WebAuthn=await getPasskeyClient();
      return new PasskeyKit({
        rpcUrl:stellarNetwork.rpcUrl,
        horizonUrl:stellarNetwork.horizonUrl,
        networkPassphrase:stellarNetwork.networkPassphrase,
        walletWasmHash:stellarNetwork.walletWasmHash,
        rpId:stellarNetwork.rpId,
        allowedOrigins:stellarNetwork.allowedOrigins,
        requireUserVerification:true,
        storage:publicPasskeyStorage,
        ...(WebAuthn?{WebAuthn}:{}),
      });
    })().catch(error=>{
      kitPromise=null;
      throw error;
    });
  }
  return kitPromise;
}

function amountToBaseUnits(amount:string,decimals:number){
  const normalized=amount.trim().replace(',','.');
  if(!/^\d+(?:\.\d+)?$/.test(normalized))throw new Error('Ingresá un monto válido.');
  const [integer,fraction='']=normalized.split('.');
  if(fraction.length>decimals)throw new Error(`El activo admite hasta ${decimals} decimales.`);
  const units=BigInt(integer)*(10n**BigInt(decimals))+BigInt(fraction.padEnd(decimals,'0')||'0');
  if(units<=0n)throw new Error('El monto debe ser mayor que cero.');
  return units;
}

function paymentId(){
  return `stellar-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
}

export class StellarWalletService implements WalletService{
  readonly mode='stellar' as const;
  private readonly pendingPayments=new Map<string,AssembledTransaction<null>>();

  async prepareWallet():Promise<void>{
    assertStellarConfiguration({passkey:true,relayer:true});
    await ensureStellarRuntime();
    if(!await isNativePasskeySupported()){
      throw new Error('Las passkeys reales requieren un Development Build y un dispositivo compatible. Expo Go no alcanza para este paso.');
    }
    await checkStellarConnection();
  }

  async createWithPasskey(input:CreateWalletInput):Promise<WalletAccount>{
    assertStellarConfiguration({passkey:true,relayer:true});
    const kit=await getPasskeyKit();
    const userName=input.username.trim()||input.displayName.trim();
    if(!userName)throw new Error('Falta el nombre de usuario para registrar la passkey.');

    const created=await kit.createWallet('Pato Pay',userName,{
      authenticatorSelection:{
        authenticatorAttachment:'platform',
        residentKey:'required',
        userVerification:'required',
      },
    });
    const submission=await submitSignedTransaction(created.signedTx);
    if(!submission.txHash){
      throw new Error('El despliegue quedó pendiente. Reintentá cuando el relayer confirme un txHash.');
    }

    await kit.confirmWalletCreation(created,submission.txHash);
    await kit.connectWallet({keyId:created.keyIdBase64});

    const account:WalletAccount={
      walletAddress:created.contractId,
      address:created.contractId,
      credentialId:created.keyIdBase64,
      network:'testnet',
      status:'active',
      signer:'passkey',
      creationTxHash:submission.txHash,
    };
    await saveWalletMetadata(account);
    return account;
  }

  async getAccount(){
    const account=await getWalletMetadata();
    if(
      !account
      ||account.network!=='testnet'
      ||account.status!=='active'
      ||account.signer!=='passkey'
      ||!StrKey.isValidContract(account.walletAddress)
    )return null;
    return account;
  }

  private async requireAccount(walletAddress?:string){
    const saved=await this.getAccount();
    const address=walletAddress??saved?.walletAddress;
    if(!address)throw new Error('Todavía no hay una wallet Stellar configurada.');
    return {saved,address};
  }

  private async requireConnectedKit(){
    const account=await this.getAccount();
    if(!account||account.signer!=='passkey')throw new Error('No hay una passkey Stellar activa para autorizar el pago.');
    const kit=await getPasskeyKit();
    if(kit.contractId!==account.walletAddress){
      const connected=await kit.connectWallet({keyId:account.credentialId});
      if(connected.contractId!==account.walletAddress){
        throw new Error('La passkey seleccionada no controla esta wallet.');
      }
    }
    return {kit,account};
  }

  async getBalance(walletAddress?:string){
    const {address}=await this.requireAccount(walletAddress);
    const balance=await getStellarBalance(address);
    return {
      walletAddress:address,
      assetCode:balance.assetCode,
      amount:balance.amount,
      formatted:balance.formatted,
      funded:balance.funded,
    };
  }

  async fundTestnet(walletAddress?:string){
    const {address}=await this.requireAccount(walletAddress);
    return fundWithFriendbot(address);
  }

  async preparePayment(input:PreparePaymentInput):Promise<PreparedPayment>{
    assertStellarConfiguration({passkey:true,relayer:true});
    if(!StrKey.isValidEd25519PublicKey(input.destination)&&!StrKey.isValidContract(input.destination)){
      throw new Error('La dirección de destino no es una dirección Stellar válida.');
    }
    const {account}=await this.requireConnectedKit();
    const amount=amountToBaseUnits(input.amount,stellarNetwork.assetDecimals);
    const client=new SACClient({
      rpcUrl:stellarNetwork.rpcUrl,
      networkPassphrase:stellarNetwork.networkPassphrase,
    }).getSACClient(stellarNetwork.assetContractId);
    const assembled=await client.transfer({
      from:account.walletAddress,
      to:input.destination,
      amount,
    });
    const prepared:PreparedPayment={
      id:paymentId(),
      walletAddress:account.walletAddress,
      destination:input.destination,
      amount:input.amount.trim().replace(',','.'),
      assetCode:stellarNetwork.assetCode,
      network:'testnet',
    };
    this.pendingPayments.set(prepared.id,assembled);
    return prepared;
  }

  async signPayment(payment:PreparedPayment):Promise<SignedPayment>{
    const transaction=this.pendingPayments.get(payment.id);
    if(!transaction)throw new Error('La preparación del pago venció. Volvé a prepararlo.');
    const {kit,account}=await this.requireConnectedKit();
    if(account.walletAddress!==payment.walletAddress)throw new Error('La wallet activa cambió antes de firmar.');

    await kit.sign(transaction);
    const signedXdr=transaction.built?.toXDR();
    if(!signedXdr)throw new Error('Stellar no pudo construir el XDR firmado.');
    return {...payment,signedXdr};
  }

  async submitPayment(payment:SignedPayment){
    const submitted=await submitSignedTransaction(payment.signedXdr);
    this.pendingPayments.delete(payment.id);
    return {...payment,...submitted};
  }

  getTransactionStatus(txHash:string){
    return getStellarTransactionStatus(txHash);
  }
}
