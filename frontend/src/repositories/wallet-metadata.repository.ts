import {env} from '@/config/env';
import type {WalletMetadataRepository} from './contracts';
import {demoWalletMetadataRepository} from './demo/wallet-metadata.repository';
import {supabaseWalletMetadataRepository} from './supabase/wallet-metadata.repository';

export const walletMetadataRepository:WalletMetadataRepository=env.demoMode?demoWalletMetadataRepository:supabaseWalletMetadataRepository;
