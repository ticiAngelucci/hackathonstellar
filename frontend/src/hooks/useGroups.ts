import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '@/features/auth/AuthProvider';
import {dataReady,dataScope} from '@/config/env';
import {groupService} from '@/services/groups/group.service';
export function useGroups(){const {session}=useAuth();return useQuery({queryKey:['groups',dataScope(session?.user.id)],queryFn:()=>groupService.list(),enabled:dataReady(session?.user.id)});}
export function useGroup(id:string){const {session}=useAuth();return useQuery({queryKey:['group',dataScope(session?.user.id),id],queryFn:()=>groupService.get(id),enabled:!!id&&dataReady(session?.user.id)});}
export function useCreateGroup(){const {session}=useAuth();const cache=useQueryClient();return useMutation({mutationFn:(name:string)=>groupService.create(name),onSuccess:()=>cache.invalidateQueries({queryKey:['groups',dataScope(session?.user.id)]})});}

export function useUpdateGroup(){const {session}=useAuth();const cache=useQueryClient();const owner=dataScope(session?.user.id);return useMutation({mutationFn:({id,name,version}:{id:string;name:string;version:number})=>groupService.updateGroup(id,name,version),onSuccess:async(group)=>{cache.setQueryData(['group',owner,group.id],group);await cache.invalidateQueries({queryKey:['groups',owner]});await cache.invalidateQueries({queryKey:['groupFund',owner,group.id]});}});}
