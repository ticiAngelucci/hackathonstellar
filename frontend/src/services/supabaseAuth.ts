import {authService} from '@/services/auth/auth.service';
import {supabasePublicKey} from '@/lib/supabase';
import {AppError} from '@/lib/errors';
/** App identity only. Never a wallet signer. */
export async function getRelayerAuthHeaders(){
 const session=await authService.getSession();
 if(!session)throw new AppError('Iniciá sesión antes de usar tu wallet.');
 return {Authorization:`Bearer ${session.access_token}`,apikey:supabasePublicKey()};
}
