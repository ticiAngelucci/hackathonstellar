export type UserProfile={id:string;displayName:string;username:string;notificationsEnabled:boolean};
export type PublicWallet={id:string;address:string;network:string;status:string};
export type ProfileUpdate=Pick<UserProfile,'displayName'|'username'|'notificationsEnabled'>;

export type PaymentRequestStatus='pending'|'approved'|'processing'|'paid'|'rejected'|'blocked'|'failed'|'expired'|'cancelled';
export type PaymentRequest={id:string;requesterId:string;payerId:string;assetId:string;amount:string;asset:string;concept:string;status:PaymentRequestStatus;createdAt?:string;updatedAt?:string;version?:number;txHash?:string};
export type CreatePaymentRequest={payerId:string;amount:string;concept:string;idempotencyKey:string};
