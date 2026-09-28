import {env} from '@/config/env';
import type {PolicyRepository} from './contracts';
import {demoPolicyRepository} from './demo/policy.repository';
import {supabasePolicyRepository} from './supabase/policy.repository';

export const policyRepository:PolicyRepository=env.demoMode?demoPolicyRepository:supabasePolicyRepository;
