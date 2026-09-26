import {DEMO_MODE} from '@/demo/demo.config';
import {DemoWalletService} from '@/services/demo/demo-wallet.service';
import type {WalletService} from '@/services/wallet/wallet.service';

const configuredMode=process.env.EXPO_PUBLIC_WALLET_MODE?.trim().toLowerCase();

if(!DEMO_MODE&&configuredMode&&configuredMode!=='mock'&&configuredMode!=='stellar'){
  throw new Error('EXPO_PUBLIC_WALLET_MODE debe ser mock o stellar.');
}

// Real application data always uses Stellar. Legacy mock remains available for isolated tests.
export const walletMode=DEMO_MODE?'mock':'stellar';
// Do not initialize Stellar, native crypto or passkey modules during a demo.
export const walletService:WalletService=DEMO_MODE
  ?new DemoWalletService()
  :new (require('@/services/wallet/stellar-wallet.service').StellarWalletService)();

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
