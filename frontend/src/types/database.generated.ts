/**
 * Supabase Data API types for the `patopay` schema.
 *
 * Keep this file aligned with the deployed schema. Regenerate it with the
 * Supabase CLI when project access is available; never add credentials here.
 */
export type Json=string|number|boolean|null|{[key:string]:Json|undefined}|Json[];

export type ProfileRow={id:string;username:string|null;display_name:string|null;notifications_enabled:boolean;created_at:string;updated_at:string};
export type WalletRow={id:string;user_id:string;provider:'mock'|'stellar';network:'mock'|'testnet';contract_address:string;wallet_wasm_hash:string|null;creation_tx_hash:string|null;status:'unverified'|'active'|'disabled';is_default:boolean;version:number;created_at:string;updated_at:string};
export type MockWalletBalanceRow={wallet_id:string;balance_minor:number;observed_at:string};
export type EventRow={id:string;owner_id:string;name:string;status:'draft';version:number;created_at:string;updated_at:string};
export type EventParticipantRow={event_id:string;user_id:string;role:'owner'|'member';joined_at:string};
export type AssetRow={id:string;network:'testnet';contract_address:string;code:string;decimals:number;enabled:boolean;created_at:string};
export type PaymentPolicyRow={id:string;user_id:string;version:number;auto_pay_limit_minor:number;approval_limit_minor:number;daily_limit_minor:number;recipient_mode:'any'|'allowlist';policy_contract_address:string|null;on_chain_revision:number|null;created_at:string};
export type PaymentRequestRow={id:string;requester_id:string;payer_id:string;source_wallet_id:string;destination_wallet_id:string;asset_id:string;amount_minor:number;memo:string|null;policy_version_id:string|null;policy_snapshot:Json;status:'pending_approval'|'approved'|'processing'|'paid'|'failed'|'rejected'|'expired'|'cancelled'|'blocked';version:number;created_at:string;updated_at:string};
export type PaymentAttemptRow={id:string;payment_request_id:string;attempt_number:number;executor:'mock'|'stellar';mode:'mock'|'stellar';status:'prepared'|'submitting'|'submitted'|'confirmed'|'failed'|'unknown'|'simulated';preparation_hash:string|null;preparation_expires_at:string|null;consumed_at:string|null;envelope_hash:string|null;tx_hash:string|null;provider_reference:string|null;ledger:number|null;receipt:Json|null;error_code:string|null;created_at:string;updated_at:string};
export type ServiceSubscriptionRow={user_id:string;service_id:string;enabled:boolean;updated_at:string};

type Table<Row,Insert=Partial<Row>,Update=Partial<Insert>>={Row:Row;Insert:Insert;Update:Update;Relationships:[]};

export type Database={
  patopay:{
    Tables:{
      profiles:Table<ProfileRow,Pick<ProfileRow,'id'>&Partial<Omit<ProfileRow,'id'>>>;
      wallets:Table<WalletRow,Omit<WalletRow,'id'|'version'|'created_at'|'updated_at'>&Partial<Pick<WalletRow,'id'|'version'|'created_at'|'updated_at'>>>;
      mock_wallet_balances:Table<MockWalletBalanceRow>;
      events:Table<EventRow,Omit<EventRow,'id'|'status'|'version'|'created_at'|'updated_at'>&Partial<Pick<EventRow,'id'|'status'|'version'|'created_at'|'updated_at'>>>;
      event_participants:Table<EventParticipantRow>;
      assets:Table<AssetRow>;
      payment_policy_versions:Table<PaymentPolicyRow>;
      policy_allowed_recipients:Table<{policy_version_id:string;recipient_profile_id:string}>;
      policy_allowed_assets:Table<{policy_version_id:string;asset_id:string}>;
      service_subscriptions:Table<ServiceSubscriptionRow,Pick<ServiceSubscriptionRow,'user_id'|'service_id'|'enabled'>&Partial<Pick<ServiceSubscriptionRow,'updated_at'>>>;
      payment_requests:Table<PaymentRequestRow>;
      payment_attempts:Table<PaymentAttemptRow>;
    };
    Views:{
      profile_directory:{Row:Pick<ProfileRow,'id'|'username'|'display_name'>;Relationships:[]};
    };
    Functions:{
      create_event_with_owner:{Args:{p_name:string};Returns:EventRow};
      replace_payment_policy:{Args:{p_auto_pay_limit_minor:number;p_approval_limit_minor:number;p_daily_limit_minor:number;p_recipient_mode:string;p_allowed_recipient_ids:string[];p_allowed_asset_ids:string[];p_expected_version:number};Returns:Json};
      create_payment_request:{Args:{p_payer_profile_id:string;p_amount_minor:number;p_asset_id:string;p_memo:string|null;p_idempotency_key:string};Returns:Json};
      decide_payment_request:{Args:{p_request_id:string;p_action:'approve'|'reject';p_expected_version:number;p_idempotency_key:string};Returns:Json};
    };
    Enums:Record<string,never>;
    CompositeTypes:Record<string,never>;
  };
};
