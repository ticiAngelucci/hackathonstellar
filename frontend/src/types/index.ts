export type TransactionStatus='paid'|'pending'|'auto'|'blocked'|'received'|'approved'|'processing'|'failed'|'rejected'|'expired'|'cancelled';

export type Transaction={
  id:string;
  title:string;
  subtitle?:string;
  amount:number;
  status:TransactionStatus;
  icon:string;
  txHash?:string;
  assetCode?:string;
  displayAmount?:string;
};

export type Group={
  id:string;
  name:string;
  members:number;
  membersVisible?:boolean;
  balance:number;
  stakingApy?:number;
  imageKey?:string;
};

export type ServiceSubscription={
  id:string;
  name:string;
  amount?:number;
  enabled:boolean;
  icon:string;
};

export type PaymentPolicy={
  minorLimits?:{auto:string;approval:string;daily:string};
  allowedRecipientIds?:string[];
  allowedAssetIds?:string[];
  version?:number;
  editable?:boolean;
  notice?:string;
  blockFollowsApproval?:boolean;
  autoPayLimit:number;
  approvalLimit:number;
  blockAbove:number;
  dailyLimit:number;
  allowedRecipientsOnly:boolean;
};
