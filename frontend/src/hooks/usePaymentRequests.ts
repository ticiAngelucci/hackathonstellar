import {useQuery} from '@tanstack/react-query';
import {useAuth} from '@/features/auth/AuthProvider';
import {paymentService} from '@/services/payments/payment.service';
import {env} from '@/config/env';
export function usePaymentRequests(){const {session}=useAuth();return useQuery({queryKey:['paymentRequests',session?.user.id],queryFn:paymentService.getPaymentRequests,enabled:!env.demoMode&&!!session});}
export function usePaymentRequest(id?:string){const {session}=useAuth();return useQuery({queryKey:['paymentRequest',session?.user.id,id],queryFn:()=>paymentService.getPaymentRequest(id!),enabled:!env.demoMode&&!!session&&!!id});}
