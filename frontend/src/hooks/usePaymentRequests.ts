import {useQuery} from '@tanstack/react-query';
import {useAuth} from '@/features/auth/AuthProvider';
import {realPaymentService} from '@/services/payments/payment.service';
import {DEMO_MODE} from '@/demo/demo.config';
export function usePaymentRequests(){const {session}=useAuth();return useQuery({queryKey:['paymentRequests',session?.user.id],queryFn:realPaymentService.getPaymentRequests,enabled:!DEMO_MODE&&!!session});}
export function usePaymentRequest(id?:string){const {session}=useAuth();return useQuery({queryKey:['paymentRequest',session?.user.id,id],queryFn:()=>realPaymentService.getPaymentRequest(id!),enabled:!DEMO_MODE&&!!session&&!!id});}
