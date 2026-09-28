import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '@/features/auth/AuthProvider';
import {dataReady,dataScope} from '@/config/env';
import {profileService} from '@/services/users/profile.service';
import type {ProfileUpdate} from '@/types/domain';
export function useProfile(){const {session}=useAuth();return useQuery({queryKey:['profile',dataScope(session?.user.id)],queryFn:profileService.getProfile,enabled:dataReady(session?.user.id)});}
export function useUpdateProfile(){const client=useQueryClient();const {session}=useAuth();return useMutation({mutationFn:(input:ProfileUpdate)=>profileService.updateProfile(input),onSuccess:profile=>client.setQueryData(['profile',dataScope(session?.user.id)],profile)});}
