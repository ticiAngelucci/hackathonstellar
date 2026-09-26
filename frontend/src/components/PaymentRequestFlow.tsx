import {useEffect,useRef,useState} from 'react';
import {router,useLocalSearchParams} from 'expo-router';
import {StyleSheet,Text,View} from 'react-native';
import Animated,{FadeInDown,useSharedValue,useAnimatedStyle,withRepeat,withSequence,withTiming} from 'react-native-reanimated';
import {Screen} from './Screen';
import {AppHeader} from './AppHeader';
import {PrimaryButton} from './PrimaryButton';
import {demoPaymentService,PAYMENT_STEPS} from '@/services/demo/demo-payment.service';
import {demoPolicyService,paymentDecision} from '@/services/demo/demo-policy.service';
import {readDemoState} from '@/demo/demo.controller';
import type {DemoRequest} from '@/demo/demo.types';
import {colors,spacing,radius,typography} from '@/constants/theme';

export function PaymentRequestFlow(){
 const {id,scenario}=useLocalSearchParams<{id?:string;scenario?:string}>();
 const [request,setRequest]=useState<DemoRequest>();
 const [decision,setDecision]=useState('approval');
 const [step,setStep]=useState(-1);
 const [done,setDone]=useState(false);
 const [message,setMessage]=useState('');
 const busy=useRef(false);
 const mounted=useRef(true);
 const opacity=useSharedValue(1);
 const pulse=useAnimatedStyle(()=>({opacity:opacity.value,transform:[{translateY:(1-opacity.value)*-8}]}));
 useEffect(()=>{opacity.value=withRepeat(withSequence(withTiming(.55,{duration:700}),withTiming(1,{duration:700})),-1);},[opacity]);
 const pay=async(r:DemoRequest,approved:boolean)=>{
  if(busy.current)return;busy.current=true;
  try{const tx=await demoPaymentService.pay(r.id,approved,i=>{if(mounted.current)setStep(i);});
   if(!mounted.current)return;
   if(!tx){setDecision('blocked');setStep(-1);return;}
   if(tx.status==='auto'){setDone(true);setStep(-1);}else router.replace({pathname:'/payment/success',params:{id:tx.id}});
  }catch{if(mounted.current){setMessage('Tu saldo no alcanza para este pago.');setStep(-1);}}
  finally{busy.current=false;}
 };
 useEffect(()=>{
  mounted.current=true;let active=true;
  const initialize=async()=>{
   const r=(id?await demoPaymentService.get(id):undefined)??await demoPaymentService.create(scenario==='auto'?3:scenario==='blocked'?100:10);
   const state=await readDemoState();const policy=await demoPolicyService.get();
   const choice=paymentDecision(policy,r.amount,state.spent);
   if(!active)return;setRequest(r);setDecision(choice);
   if(choice==='auto')void pay(r,false);
   if(choice==='blocked')void demoPaymentService.block(r.id);
  };
  void initialize();return ()=>{active=false;mounted.current=false;};
 },[id,scenario]);
 const processing=step>=0;
 const blocked=decision==='blocked';
 const title=done?'Pato lo pagó automáticamente ✓':blocked?'Bloqueado por tus reglas.':request?.title??'Solicitud de pago';
 return <Screen><AppHeader title="Solicitud de pago"/>
  <Animated.View entering={FadeInDown.springify()} style={styles.card}>
   <Animated.Image source={done?require('../../assets/pato/pato-success.png'):require('../../assets/pato/pato-approval.png')} resizeMode="contain" style={[styles.pato,processing&&pulse]}/>
   <Text style={[styles.title,blocked&&{color:colors.danger},done&&{color:colors.success}]}>{title}</Text>
   <Text style={styles.copy}>{blocked?'Este pago supera tu límite.':done?'Pato revisó tus reglas.':decision==='auto'?'Pato revisó tus reglas.':'Te pidieron'}</Text>
   <Text style={styles.amount}>{(request?.amount??(scenario==='auto'?3:scenario==='blocked'?100:10)).toFixed(2)} USDC</Text>
   <Text style={styles.copy}>{decision==='auto'?'3 USDC está dentro de tu límite.':blocked?'Tu plata sigue en tu cuenta.':'Te agregaron al asado. ¿Pagamos tu parte?'}</Text>
   {processing&&<><Animated.Text key={step} entering={FadeInDown.duration(180)} style={styles.status}>{decision==='auto'&&step===1?'3 USDC está dentro de tu límite.':PAYMENT_STEPS[step].text}</Animated.Text><View style={styles.dots}>{PAYMENT_STEPS.map((_,i)=><View key={i} style={[styles.dot,{backgroundColor:i<=step?colors.yellow:colors.border}]}/>)}</View></>}
   {!!message&&<Text style={styles.copy}>{message}</Text>}
  </Animated.View>
  <View style={styles.actions}>{!processing&&!done&&!blocked&&!message&&request&&decision==='approval'&&<><PrimaryButton title="Aprobar y pagar" onPress={()=>void pay(request,true)}/><PrimaryButton variant="secondary" title="Rechazar" onPress={()=>{if(busy.current)return;busy.current=true;void demoPaymentService.reject(request.id).then(()=>router.replace('/(tabs)'));}}/></>}
  {!processing&&(done||blocked||!!message)&&<PrimaryButton title="Volver al inicio" onPress={()=>router.replace('/(tabs)')}/>}</View>
 </Screen>;
}
const styles=StyleSheet.create({card:{padding:spacing.lg,alignItems:'center',backgroundColor:colors.surface,borderRadius:radius.lg,borderWidth:1,borderColor:colors.border},pato:{width:180,height:180},title:{...typography.h2,color:colors.text,textAlign:'center'},copy:{...typography.body,color:colors.muted,textAlign:'center',marginTop:spacing.sm},amount:{...typography.hero,color:colors.text,marginVertical:spacing.md},status:{...typography.bodyStrong,color:colors.yellow,textAlign:'center',marginTop:spacing.lg},dots:{flexDirection:'row',gap:8,marginTop:spacing.md},dot:{width:8,height:8,borderRadius:4},actions:{gap:spacing.sm,marginTop:spacing.lg}});
