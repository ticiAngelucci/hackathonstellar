export type WalletMode='mock'|'stellar';
export type WalletNetwork='testnet';
export type WalletStatus='active'|'mock';

export type CreateWalletInput={
  displayName:string;
  username:string;
};

export type WalletAccount={
  walletAddress:string;
  /** @deprecated Prefer walletAddress. Kept so existing UI remains compatible. */
  address:string;
  credentialId:string;
  network:WalletNetwork;
  status:WalletStatus;
  signer:'passkey'|'mock';
  creationTxHash?:string;
};

export type WalletBalance={
  walletAddress:string;
  assetCode:string;
  amount:number;
  formatted:string;
  funded:boolean;
};

export type PreparePaymentInput={
  destination:string;
  amount:string;
};

export type PreparedPayment={
  id:string;
  walletAddress:string;
  destination:string;
  amount:string;
  assetCode:string;
  network:WalletNetwork;
};

export type SignedPayment=PreparedPayment&{
  signedXdr:string;
};

export type SubmittedPayment=SignedPayment&{
  txHash:string;
  status:'success'|'pending';
  explorerUrl:string;
};

export type WalletTransactionStatus={
  txHash:string;
  status:'success'|'pending'|'failed'|'not_found';
  explorerUrl:string;
};

export type TestnetFundingResult={
  address:string;
  network:WalletNetwork;
  txHash?:string;
};
