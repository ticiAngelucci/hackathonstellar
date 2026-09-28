import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {QueryClientProvider} from '@tanstack/react-query';
import {queryClient} from '@/lib/query-client';
import {AuthProvider,NavigationGuard} from '@/features/auth/AuthProvider';
import {OnboardingProvider} from '@/features/onboarding/store/OnboardingProvider';
import {Stack} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
import {AppLockGate} from '@/features/security/components/AppLockGate';
import {colors} from '@/constants/theme';
import {useEffect} from 'react';
import {env} from '@/config/env';
import {checkBackendConnection} from '@/services/health/backend-health';
import {getAuthRedirectUrl} from '@/services/auth/auth-redirect';

export default function Root(){
  useEffect(()=>{if(__DEV__&&!env.demoMode){console.log('[Auth] email redirect:',getAuthRedirectUrl());void checkBackendConnection();}},[]);
  return (
    <GestureHandlerRootView style={{flex:1}}>
      <StatusBar style="light"/>
      <QueryClientProvider client={queryClient}><AuthProvider>
      <NavigationGuard/>
      <OnboardingProvider>
      <AppLockGate>
        <Stack
          screenOptions={{
            headerShown:false,
            contentStyle:{backgroundColor:colors.bg},
            animation:'slide_from_right',
          }}
        />
      </AppLockGate>
      </OnboardingProvider>
      </AuthProvider></QueryClientProvider>
    </GestureHandlerRootView>
  );
}
