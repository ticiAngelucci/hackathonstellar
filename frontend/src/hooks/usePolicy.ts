import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '@/features/auth/AuthProvider';
import {DEMO_MODE} from '@/demo/demo.config';
import {policyService} from '@/services/appDataService';
import type {PaymentPolicy} from '@/types';
export function usePolicy(){const {session}=useAuth();return useQuery({queryKey:['policy',DEMO_MODE?'demo':session?.user.id],queryFn:()=>policyService.get(),enabled:DEMO_MODE||!!session});}
export function useSavePolicy(){const {session}=useAuth();const cache=useQueryClient();return useMutation({mutationFn:(policy:PaymentPolicy)=>policyService.save(policy),onSuccess:()=>cache.invalidateQueries({queryKey:['policy',DEMO_MODE?'demo':session?.user.id]})});}
