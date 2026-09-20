import {PropsWithChildren,ReactNode} from 'react';
import {OnboardingShell} from '@/features/onboarding/components/OnboardingShell';

type OnboardingPageProps=PropsWithChildren<{
  step:number;
  actions:ReactNode;
  showBack?:boolean;
}>;

export function OnboardingPage({step,actions,showBack=true,children}:OnboardingPageProps){
  return (
    <OnboardingShell progress={step/14} actions={actions} showBack={showBack} transitionKey={step}>
      {children}
    </OnboardingShell>
  );
}
