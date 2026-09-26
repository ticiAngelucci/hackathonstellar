import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '@/features/auth/AuthProvider';
import {DEMO_MODE} from '@/demo/demo.config';
import {eventService} from '@/services/eventService';
export function useGroups(){const {session}=useAuth();return useQuery({queryKey:['groups',DEMO_MODE?'demo':session?.user.id],queryFn:()=>eventService.list(),enabled:DEMO_MODE||!!session});}
export function useGroup(id:string){const {session}=useAuth();return useQuery({queryKey:['group',DEMO_MODE?'demo':session?.user.id,id],queryFn:()=>eventService.get(id),enabled:!!id&&(DEMO_MODE||!!session)});}
export function useCreateGroup(){const {session}=useAuth();const cache=useQueryClient();return useMutation({mutationFn:(name:string)=>eventService.create(name),onSuccess:()=>cache.invalidateQueries({queryKey:['groups',DEMO_MODE?'demo':session?.user.id]})});}

export function useUpdateGroup(){const {session}=useAuth();const cache=useQueryClient();const owner=DEMO_MODE?'demo':session?.user.id;return useMutation({mutationFn:({id,name,version}:{id:string;name:string;version:number})=>eventService.updateGroup(id,name,version),onSuccess:async(group)=>{cache.setQueryData(['group',owner,group.id],group);await cache.invalidateQueries({queryKey:['groups',owner]});await cache.invalidateQueries({queryKey:['groupFund',owner,group.id]});}});}
