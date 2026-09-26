import {useQuery} from '@tanstack/react-query';
import {useAuth} from '@/features/auth/AuthProvider';
import {DEMO_MODE} from '@/demo/demo.config';
import {fundService} from '@/services/funds/fund.service';
export function useGroupFund(id?:string){const {session}=useAuth();return useQuery({queryKey:['groupFund',DEMO_MODE?'demo':session?.user.id,id],queryFn:()=>fundService.getGroupFund(id!),enabled:!!id&&(DEMO_MODE||!!session)});}
