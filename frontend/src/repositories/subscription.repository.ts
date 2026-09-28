import {env} from '@/config/env';
import type {SubscriptionRepository} from './contracts';
import {demoSubscriptionRepository} from './demo/subscription.repository';
import {supabaseSubscriptionRepository} from './supabase/subscription.repository';

export const subscriptionRepository:SubscriptionRepository=env.demoMode?demoSubscriptionRepository:supabaseSubscriptionRepository;
