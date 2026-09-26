// Compatibility exports. All application repositories use the shared authenticated client.
export {getSupabase,appDatabase} from '@/lib/supabase';
export {AppError as SupabaseError} from '@/lib/errors';
