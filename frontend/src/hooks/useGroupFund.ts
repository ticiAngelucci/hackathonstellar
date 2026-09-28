import {useQuery} from '@tanstack/react-query';
import {useAuth} from '@/features/auth/AuthProvider';
import {dataReady,dataScope} from '@/config/env';
import {fundService} from '@/services/funds/fund.service';
export function useGroupFund(id?:string){const {session}=useAuth();return useQuery({queryKey:['groupFund',dataScope(session?.user.id),id],queryFn:()=>fundService.getGroupFund(id!),enabled:!!id&&dataReady(session?.user.id)});}
