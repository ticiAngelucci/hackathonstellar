import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '@/features/auth/AuthProvider';
import {DEMO_MODE} from '@/demo/demo.config';
import {profileService} from '@/services/users/profile.service';
import type {ProfileUpdate} from '@/types/domain';
export function useProfile(){const {session}=useAuth();return useQuery({queryKey:['profile',session?.user.id],queryFn:profileService.getProfile,enabled:!DEMO_MODE&&!!session});}
export function useUpdateProfile(){const client=useQueryClient();const {session}=useAuth();return useMutation({mutationFn:(input:ProfileUpdate)=>profileService.updateProfile(input),onSuccess:profile=>client.setQueryData(['profile',session?.user.id],profile)});}
