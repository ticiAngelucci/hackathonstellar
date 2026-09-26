import {useQuery} from '@tanstack/react-query';
import {useAuth} from '@/features/auth/AuthProvider';
import {DEMO_MODE} from '@/demo/demo.config';
import {balanceService} from '@/services/wallet/balance.service';
export function useWalletBalance(){const {session}=useAuth();return useQuery({queryKey:['walletBalance',DEMO_MODE?'demo':session?.user.id],queryFn:balanceService.get,enabled:DEMO_MODE||!!session});}
