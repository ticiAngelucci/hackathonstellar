import {readDemoState,mutateDemo} from '@/demo/demo.controller';
import type {PaymentPolicy} from '@/types';
export const demoPolicyService={async get(){return (await readDemoState()).policy;},save(policy:PaymentPolicy){return mutateDemo(state=>state.policy={...policy});}};
export function paymentDecision(policy:PaymentPolicy,amount:number,spent:number){return amount>policy.blockAbove||amount>policy.approvalLimit||spent+amount>policy.dailyLimit?'blocked':amount<=policy.autoPayLimit?'auto':'approval';}
