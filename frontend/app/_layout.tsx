import {QueryClientProvider} from '@tanstack/react-query';
import {queryClient} from '@/lib/query-client';
import {AuthProvider,NavigationGuard} from '@/features/auth/AuthProvider';
import {OnboardingProvider} from '@/features/onboarding/store/OnboardingProvider';
import 'react-native-gesture-handler';
import 'react-native-reanimated';
import {Stack} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {ReduceMotion,ReducedMotionConfig} from 'react-native-reanimated';
import {AppLockGate} from '@/features/security/components/AppLockGate';
import {colors} from '@/constants/theme';

export default function Root(){
  return (
    <GestureHandlerRootView style={{flex:1}}>
      <ReducedMotionConfig mode={ReduceMotion.Never}/>
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
