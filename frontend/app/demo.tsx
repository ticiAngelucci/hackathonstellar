import {useState} from 'react';
import {Redirect,router} from 'expo-router';
import {Text,View} from 'react-native';
import {Screen} from '@/components/Screen';
import {AppHeader} from '@/components/AppHeader';
import {PrimaryButton} from '@/components/PrimaryButton';
import {DEMO_MODE} from '@/demo/demo.config';
import {resetDemoState,mutateDemo} from '@/demo/demo.controller';
import {demoAccount} from '@/demo/demo.data';
import {demoPaymentService} from '@/services/demo/demo-payment.service';
import {markOnboardingCompleted} from '@/features/onboarding/services/onboardingStorage';
import {colors,spacing} from '@/constants/theme';
export default function DemoControl(){
 const [busy,setBusy]=useState(false);
 if(!DEMO_MODE&&!__DEV__)return <Redirect href="/"/>;
 const run=async(action:()=>Promise<void>)=>{if(busy)return;setBusy(true);try{await action();}finally{setBusy(false);}};
 const reset=()=>run(async()=>{await resetDemoState();router.dismissAll();router.replace('/onboarding');});
 return <Screen><AppHeader title="Opciones"/><Text style={{color:colors.muted,marginBottom:spacing.lg}}>{DEMO_MODE?'Elegí cómo continuar.':'Activá EXPO_PUBLIC_DEMO_MODE=true y reiniciá Expo para usar estos controles.'}</Text>
 <View style={{gap:spacing.sm}}>
 <PrimaryButton disabled={!DEMO_MODE||busy} title="Empezar de nuevo" onPress={()=>void reset()}/>
 <PrimaryButton disabled={!DEMO_MODE||busy} title="Volver a la bienvenida" onPress={()=>void run(async()=>{await resetDemoState();router.dismissAll();router.replace('/onboarding');})}/>
 <PrimaryButton disabled={!DEMO_MODE||busy} title="Ir al inicio" onPress={()=>void run(async()=>{await mutateDemo(s=>{s.wallet={...demoAccount};});await markOnboardingCompleted();router.replace('/(tabs)');})}/>
 {([['Solicitud de pago · 10 USDC',10],['Pago automático · 3 USDC',3],['Pago fuera del límite · 100 USDC',100]] as const).map(([title,amount])=><PrimaryButton key={amount} disabled={!DEMO_MODE||busy} title={title} onPress={()=>void run(async()=>{const request=await demoPaymentService.create(amount);router.push({pathname:'/payment/request',params:{id:request.id}});})}/>)}
 <PrimaryButton disabled={!DEMO_MODE||busy} title="Ver comprobante" onPress={()=>void run(async()=>{const tx=await mutateDemo(s=>{const tx={id:'demo-preview-'+(++s.sequence),title:'Asado del viernes',amount:-10,status:'paid' as const,icon:'checkmark',txHash:'DEMO-7F82-PATO'};s.transactions.push(tx);return tx;});router.push({pathname:'/payment/success',params:{id:tx.id}});})}/>
 </View></Screen>;
}
