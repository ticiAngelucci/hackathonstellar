import {env} from '@/config/env';
import type {ProfileRepository} from './contracts';
import {demoProfileRepository} from './demo/profile.repository';
import {supabaseProfileRepository} from './supabase/profile.repository';

export const profileRepository:ProfileRepository=env.demoMode?demoProfileRepository:supabaseProfileRepository;
