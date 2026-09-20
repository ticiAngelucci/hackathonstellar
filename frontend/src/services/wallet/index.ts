import {MockWalletService} from '@/services/wallet/mock-wallet.service';
import {StellarWalletService} from '@/services/wallet/stellar-wallet.service';

const configuredMode=process.env.EXPO_PUBLIC_WALLET_MODE?.trim().toLowerCase();

if(configuredMode&&configuredMode!=='mock'&&configuredMode!=='stellar'){
  throw new Error('EXPO_PUBLIC_WALLET_MODE debe ser mock o stellar.');
}

export const walletMode=configuredMode==='mock'?'mock':'stellar';
export const walletService=walletMode==='mock'?new MockWalletService():new StellarWalletService();

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
export type {WalletService} from '@/services/wallet/wallet.service';
