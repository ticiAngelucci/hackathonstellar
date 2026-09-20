export type PolicyPreset='safe'|'balanced'|'custom';

export type OnboardingProfile={
  educationStep:number;
  displayName:string;
  username:string;
  walletAddress?:string;
  walletNetwork?:'testnet';
  walletStatus?:'active'|'mock';
  walletCredentialId?:string;
  walletCreationTxHash?:string;
  walletCreated:boolean;
  passkeyCreated:boolean;
  notificationsEnabled:boolean;
  policyPreset:PolicyPreset;
};
