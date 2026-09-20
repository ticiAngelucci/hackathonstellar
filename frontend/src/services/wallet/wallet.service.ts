import type {
  CreateWalletInput,
  PreparedPayment,
  PreparePaymentInput,
  SignedPayment,
  SubmittedPayment,
  TestnetFundingResult,
  WalletAccount,
  WalletBalance,
  WalletMode,
  WalletTransactionStatus,
} from '@/services/wallet/types';

export interface WalletService{
  readonly mode:WalletMode;
  prepareWallet():Promise<void>;
  createWithPasskey(input:CreateWalletInput):Promise<WalletAccount>;
  getAccount():Promise<WalletAccount|null>;
  getBalance(walletAddress?:string):Promise<WalletBalance>;
  fundTestnet(walletAddress?:string):Promise<TestnetFundingResult>;
  preparePayment(input:PreparePaymentInput):Promise<PreparedPayment>;
  signPayment(payment:PreparedPayment):Promise<SignedPayment>;
  submitPayment(payment:SignedPayment):Promise<SubmittedPayment>;
  getTransactionStatus(txHash:string):Promise<WalletTransactionStatus>;
}

export type {
  CreateWalletInput,
  PreparedPayment,
  PreparePaymentInput,
  SignedPayment,
  SubmittedPayment,
  TestnetFundingResult,
  WalletAccount,
  WalletBalance,
  WalletMode,
  WalletTransactionStatus,
} from '@/services/wallet/types';
