import {env} from '@/config/env';
import {DemoWalletService} from '@/services/demo/demo-wallet.service';
import type {WalletService} from '@/services/wallet/wallet.service';

export const walletMode=env.demoMode?'mock':env.walletMode;
// Do not initialize Stellar, native crypto or passkey modules during a demo.
export const walletService:WalletService=env.demoMode
  ?new DemoWalletService()
  :walletMode==='mock'
    ?new (require('@/services/wallet/mock-wallet.service').MockWalletService)()
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
