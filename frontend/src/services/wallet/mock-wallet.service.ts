import {CreateWalletInput,PreparedPayment,SignedPayment,WalletAccount,WalletService} from '@/services/wallet/wallet.service';
import {getWalletMetadata,saveWalletMetadata} from '@/services/wallet/wallet-metadata';

const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const wait=(duration:number)=>new Promise(resolve=>setTimeout(resolve,duration));

function randomToken(length:number){
  return Array.from({length},()=>alphabet[Math.floor(Math.random()*alphabet.length)]).join('');
}

export class MockWalletService implements WalletService{
  readonly mode='mock' as const;

  async prepareWallet(){
    await wait(900);
  }

  async createWithPasskey(_input:CreateWalletInput):Promise<WalletAccount>{
    await wait(1200);
    const address=`G${randomToken(55)}`;
    const account:WalletAccount={
      walletAddress:address,
      address,
      credentialId:`mock-passkey-${randomToken(20)}`,
      network:'testnet',
      status:'mock',
      signer:'mock',
    };
    await saveWalletMetadata(account);
    return account;
  }

  async getAccount(){
    const account=await getWalletMetadata();
    return account?.status==='mock'&&account.signer==='mock'?account:null;
  }

  async getBalance(walletAddress?:string){
    const account=walletAddress?null:await this.getAccount();
    const address=walletAddress??account?.walletAddress;
    if(!address)throw new Error('Todavía no hay una wallet configurada.');
    return {walletAddress:address,assetCode:'USDC',amount:100,formatted:'100',funded:true};
  }

  async fundTestnet(walletAddress?:string){
    const account=walletAddress?null:await this.getAccount();
    const address=walletAddress??account?.walletAddress;
    if(!address)throw new Error('Todavía no hay una wallet configurada.');
    await wait(700);
    return {address,network:'testnet' as const,txHash:`mock-${randomToken(32)}`};
  }

  async preparePayment(input:{destination:string;amount:string}):Promise<PreparedPayment>{
    const account=await this.getAccount();
    if(!account)throw new Error('Todavía no hay una wallet configurada.');
    await wait(450);
    return {
      id:`mock-payment-${randomToken(12)}`,
      walletAddress:account.walletAddress,
      destination:input.destination,
      amount:input.amount,
      assetCode:'USDC',
      network:'testnet',
    };
  }

  async signPayment(payment:PreparedPayment):Promise<SignedPayment>{
    await wait(500);
    return {...payment,signedXdr:`mock-xdr-${randomToken(30)}`};
  }

  async submitPayment(payment:SignedPayment){
    await wait(700);
    const txHash=`mock-${randomToken(56)}`;
    return {...payment,txHash,status:'success' as const,explorerUrl:''};
  }

  async getTransactionStatus(txHash:string){
    return {txHash,status:'success' as const,explorerUrl:''};
  }
}
