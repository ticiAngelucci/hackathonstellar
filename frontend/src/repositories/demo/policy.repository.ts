import {readDemoState,mutateDemo} from '@/demo/demo.controller';
import type {PolicyRepository} from '@/repositories/contracts';
import type {PaymentPolicy} from '@/types';

export function paymentDecision(policy:PaymentPolicy,amount:number,spent:number){return amount>policy.blockAbove||amount>policy.approvalLimit||spent+amount>policy.dailyLimit?'blocked':amount<=policy.autoPayLimit?'auto':'approval';}

export const demoPolicyRepository:PolicyRepository={
  async latest(){
    const policy=(await readDemoState()).policy;
    return {id:'demo-policy',version:policy.version??1,auto_pay_limit_minor:String(Math.round(policy.autoPayLimit*10_000_000)),approval_limit_minor:String(Math.round(policy.approvalLimit*10_000_000)),daily_limit_minor:String(Math.round(policy.dailyLimit*10_000_000)),recipient_mode:policy.allowedRecipientsOnly?'allowlist':'any',allowed_recipient_ids:policy.allowedRecipientIds??[],allowed_asset_ids:['demo-usdc']};
  },
  async create(input){
    await mutateDemo(state=>{state.policy={...state.policy,autoPayLimit:Number(input.auto_pay_limit_minor)/10_000_000,approvalLimit:Number(input.approval_limit_minor)/10_000_000,blockAbove:Number(input.approval_limit_minor)/10_000_000,dailyLimit:Number(input.daily_limit_minor)/10_000_000,allowedRecipientsOnly:input.recipient_mode==='allowlist',allowedRecipientIds:input.allowed_recipient_ids,allowedAssetIds:input.allowed_asset_ids,version:input.expected_version+1};});
    return {id:'demo-policy',version:input.expected_version+1,auto_pay_limit_minor:input.auto_pay_limit_minor,approval_limit_minor:input.approval_limit_minor,daily_limit_minor:input.daily_limit_minor,recipient_mode:input.recipient_mode,allowed_recipient_ids:input.allowed_recipient_ids,allowed_asset_ids:input.allowed_asset_ids};
  },
};
