import {useQuery} from '@tanstack/react-query';
import {useAuth} from '@/features/auth/AuthProvider';
import {dataReady,dataScope} from '@/config/env';
import {transactionService} from '@/services/transactions/transaction.service';
export function useTransactions(){const {session}=useAuth();return useQuery({queryKey:['transactions',dataScope(session?.user.id)],queryFn:()=>transactionService.list(),enabled:dataReady(session?.user.id)});}
