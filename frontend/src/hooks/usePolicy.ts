import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '@/features/auth/AuthProvider';
import {dataReady,dataScope} from '@/config/env';
import {policyService} from '@/services/policies/policy.service';
import type {PaymentPolicy} from '@/types';
export function usePolicy(){const {session}=useAuth();return useQuery({queryKey:['policy',dataScope(session?.user.id)],queryFn:()=>policyService.get(),enabled:dataReady(session?.user.id)});}
export function useSavePolicy(){const {session}=useAuth();const cache=useQueryClient();return useMutation({mutationFn:(policy:PaymentPolicy)=>policyService.save(policy),onSuccess:()=>cache.invalidateQueries({queryKey:['policy',dataScope(session?.user.id)]})});}
