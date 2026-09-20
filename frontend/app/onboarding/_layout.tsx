import {Stack} from 'expo-router';
import {OnboardingProvider} from '@/features/onboarding/store/OnboardingProvider';
import {colors} from '@/constants/theme';

export default function OnboardingLayout(){
  return (
    <OnboardingProvider>
      <Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:colors.bg},animation:'slide_from_right'}}/>
    </OnboardingProvider>
  );
}
