import {subscriptionService,policyService,defaultPaymentPolicy} from '@/services/appDataService';
import {demoStakingService} from '@/services/demo/demo-staking.service';
import {DEMO_MODE} from '@/demo/demo.config';
import {useState} from 'react';
import {useWindowDimensions} from 'react-native';
import {PrimaryButton} from '@/components/PrimaryButton';
import {SecondaryButton} from '@/components/SecondaryButton';
import {OnboardingShell} from '@/features/onboarding/components/OnboardingShell';
import {useEducationFlow} from '@/features/onboarding/hooks/useEducationFlow';
import {useOnboarding} from '@/features/onboarding/store/OnboardingProvider';
import {BalanceStep} from '@/features/onboarding/steps/BalanceStep';
import {FundChoice,SharedFundStep} from '@/features/onboarding/steps/SharedFundStep';
import {PaymentDecision,PaymentExampleStep} from '@/features/onboarding/steps/PaymentExampleStep';
import {PermissionsStep} from '@/features/onboarding/steps/PermissionsStep';
import {ServicesStep} from '@/features/onboarding/steps/ServicesStep';
import {WelcomeStep} from '@/features/onboarding/steps/WelcomeStep';

export default function EducationFlow(){
  const {height}=useWindowDimensions();
  const {profile,updateProfile}=useOnboarding();
  const {step,direction,next,back}=useEducationFlow();
  const [stakingActive,setStakingActive]=useState(false);
  const [fundChoice,setFundChoice]=useState<FundChoice|null>(null);
  const [enabledServices,setEnabledServices]=useState<string[]>(profile.enabledServiceIds??[]);
  const [paymentDecision,setPaymentDecision]=useState<PaymentDecision>(null);
  const compact=height<720;

  const toggleService=(id:string)=>{
    if(DEMO_MODE)void subscriptionService.set(id,!enabledServices.includes(id));
    const next=enabledServices.includes(id)?enabledServices.filter(item=>item!==id):[...enabledServices,id];
    setEnabledServices(next);updateProfile({enabledServiceIds:next});
  };

  const patoVariant=step===1?'hero':step===3||step===6?(paymentDecision==='paid'?'success':'approval'):'agent';
  const patoSize=compact?(step===1?112:84):(step===1?152:112);

  const content=()=>{
    switch(step){
      case 1:return <WelcomeStep/>;
      case 2:return <BalanceStep active={stakingActive} onActivate={()=>{setStakingActive(true);if(DEMO_MODE)void demoStakingService.activate();}}/>;
      case 3:return <SharedFundStep selected={fundChoice} onSelect={setFundChoice}/>;
      case 4:return <ServicesStep enabled={enabledServices} onToggle={toggleService}/>;
      case 5:return <PermissionsStep selected={profile.policyPreset} onSelect={policyPreset=>{updateProfile({policyPreset});if(DEMO_MODE)void policyService.save({...defaultPaymentPolicy,autoPayLimit:policyPreset==='safe'?0:5});}}/>;
      default:return <PaymentExampleStep decision={paymentDecision}/>;
    }
  };

  const actions=()=>{
    switch(step){
      case 1:return <PrimaryButton title="Mostrame" onPress={next}/>;
      case 2:return <PrimaryButton disabled={!stakingActive} title="Eso me gusta" onPress={next}/>;
      case 3:return <PrimaryButton disabled={!fundChoice} title="Seguir" onPress={next}/>;
      case 4:return <PrimaryButton disabled={enabledServices.length===0} title="Que Pato se ocupe" onPress={next}/>;
      case 5:return <PrimaryButton title="Me quedo con esta" onPress={next}/>;
      default:
        return paymentDecision?(
          <PrimaryButton title="Armemos mi cuenta" onPress={next}/>
        ):(
          <>
            <PrimaryButton title="Pagar" onPress={()=>setPaymentDecision('paid')}/>
            <SecondaryButton title="Ahora no" onPress={()=>setPaymentDecision('later')}/>
          </>
        );
    }
  };

  return (
    <OnboardingShell
      progress={step/14}
      actions={actions()}
      direction={direction}
      onBack={back}
      patoSize={patoSize}
      patoVariant={patoVariant}
      transitionKey={step}
    >
      {content()}
    </OnboardingShell>
  );
}
