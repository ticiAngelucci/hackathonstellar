export type TransactionStatus='paid'|'pending'|'auto'|'blocked'|'received';

export type Transaction={
  id:string;
  title:string;
  subtitle?:string;
  amount:number;
  status:TransactionStatus;
  icon:string;
  txHash?:string;
};

export type Group={
  id:string;
  name:string;
  members:number;
  balance:number;
  stakingApy?:number;
  imageKey?:string;
};

export type ServiceSubscription={
  id:string;
  name:string;
  amount:number;
  enabled:boolean;
  icon:string;
};

export type PaymentPolicy={
  autoPayLimit:number;
  approvalLimit:number;
  blockAbove:number;
  dailyLimit:number;
  allowedRecipientsOnly:boolean;
};
