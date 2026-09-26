import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '@/features/auth/AuthProvider';
import {DEMO_MODE} from '@/demo/demo.config';
import {transactionService} from '@/services/appDataService';
import {realPaymentService} from '@/services/payments/payment.service';
import {mapActivity} from '@/services/transactions/transaction.service';
export function useTransactions(){const {session}=useAuth();const cache=useQueryClient();return useQuery({queryKey:['transactions',DEMO_MODE?'demo':session?.user.id],queryFn:async()=>{
 if(DEMO_MODE)return transactionService.list();
 const requests=await cache.fetchQuery({queryKey:['paymentRequests',session?.user.id],queryFn:realPaymentService.getPaymentRequests});
 return requests.map(request=>mapActivity(request,session!.user.id));
},enabled:DEMO_MODE||!!session});}
