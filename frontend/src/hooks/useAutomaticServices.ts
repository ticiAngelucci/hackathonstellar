import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '@/features/auth/AuthProvider';
import {DEMO_MODE} from '@/demo/demo.config';
import {subscriptionService} from '@/services/appDataService';
export function useAutomaticServices(){const {session}=useAuth();return useQuery({queryKey:['services',DEMO_MODE?'demo':session?.user.id],queryFn:()=>subscriptionService.list(),enabled:DEMO_MODE||!!session});}
export function useSetAutomaticService(){const {session}=useAuth();const cache=useQueryClient();const key=['services',DEMO_MODE?'demo':session?.user.id];
 return useMutation({mutationFn:({id,enabled}:{id:string;enabled:boolean})=>subscriptionService.set(id,enabled),
 onMutate:async({id,enabled})=>{await cache.cancelQueries({queryKey:key});const previous=cache.getQueryData<Map<string,boolean>>(key);cache.setQueryData(key,new Map(previous).set(id,enabled));return {previous};},
 onError:(_error,_variables,context)=>{if(context?.previous)cache.setQueryData(key,context.previous);},
 onSettled:()=>cache.invalidateQueries({queryKey:key})});
}
