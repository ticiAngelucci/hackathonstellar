import {readDemoState,mutateDemo} from '@/demo/demo.controller';
import type {SubscriptionRepository} from '@/repositories/contracts';

export const demoSubscriptionRepository:SubscriptionRepository={
  async list(){return Object.entries((await readDemoState()).subscriptions).map(([service_id,enabled])=>({user_id:'demo',service_id,enabled,updated_at:new Date(0).toISOString()}));},
  async set(_userId,serviceId,enabled){await mutateDemo(state=>state.subscriptions[serviceId]=enabled);return {user_id:'demo',service_id:serviceId,enabled,updated_at:new Date(0).toISOString()};},
};
