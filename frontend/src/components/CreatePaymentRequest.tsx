import {useRef,useState} from 'react';
import {Text,TextInput,View} from 'react-native';
import {useQueryClient} from '@tanstack/react-query';
import {router} from 'expo-router';
import {PrimaryButton} from './PrimaryButton';
import {profileService} from '@/services/users/profile.service';
import {realPaymentService} from '@/services/payments/payment.service';
import {requireAssetId} from '@/services/api/money';
import {PatoPayApiError} from '@/services/api/patopayApi';
import {userMessage} from '@/lib/errors';
import {useAuth} from '@/features/auth/AuthProvider';
import {colors,spacing,radius} from '@/constants/theme';
export function CreatePaymentRequest(){
 const cache=useQueryClient();const {session}=useAuth();
 const [username,setUsername]=useState(''),[amount,setAmount]=useState(''),[concept,setConcept]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 // Keep the identical payload/key across uncertain network failures. A changed form is a new action.
 const pending=useRef<{form:string;key:string;payerId?:string;createdId?:string}|null>(null);
 const submit=async()=>{
  if(busy)return;setBusy(true);setError('');
  try{
   requireAssetId();
   const form=JSON.stringify([session?.user.id,username.trim().toLowerCase(),amount.trim(),concept.trim()]);
   if(pending.current?.form!==form)pending.current={form,key:`request-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`};
   const action=pending.current;
   if(!action.payerId)action.payerId=(await profileService.findProfile(username)).id;
   if(!action.createdId)action.createdId=(await realPaymentService.createPaymentRequest({payerId:action.payerId,amount,concept,idempotencyKey:action.key})).id;
   void cache.invalidateQueries({queryKey:['paymentRequests',session?.user.id]});
   void cache.invalidateQueries({queryKey:['transactions',session?.user.id]});
   router.push({pathname:'/payment/request',params:{id:action.createdId}});
  }catch(cause){
   // A deterministic validation rejection did not create a request. Network/409 retries retain the key.
   if(cause instanceof PatoPayApiError&&[404,422].includes(cause.status))pending.current=null;
   setError(userMessage(cause));
  }finally{setBusy(false);}
 };
 const inputStyle={color:colors.text,backgroundColor:colors.surface,padding:spacing.md,borderRadius:radius.md};
 return <View style={{gap:12,marginBottom:24}}>
 <Text style={{color:colors.text,fontWeight:'700'}}>Pedir un pago</Text>
 <TextInput accessibilityLabel="Usuario al que pedir el pago" placeholder="@usuario" placeholderTextColor={colors.muted} autoCapitalize="none" value={username} onChangeText={setUsername} editable={!busy} style={inputStyle}/>
 <TextInput accessibilityLabel="Monto en USDC" placeholder="Monto en USDC" placeholderTextColor={colors.muted} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} editable={!busy} style={inputStyle}/>
 <TextInput accessibilityLabel="Concepto" placeholder="Concepto" placeholderTextColor={colors.muted} value={concept} onChangeText={setConcept} maxLength={500} editable={!busy} style={inputStyle}/>
 {!!error&&<Text style={{color:colors.danger}}>{error}</Text>}
 <PrimaryButton title={busy?'Creando…':'Crear solicitud'} disabled={busy||!username.trim()||!amount.trim()} onPress={()=>void submit()}/>
 </View>;
}
