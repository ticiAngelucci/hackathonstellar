import {env} from '@/config/env';
import type {GroupRepository} from './contracts';
import {demoGroupRepository} from './demo/group.repository';
import {supabaseGroupRepository} from './supabase/group.repository';

export const groupRepository:GroupRepository=env.demoMode?demoGroupRepository:supabaseGroupRepository;
