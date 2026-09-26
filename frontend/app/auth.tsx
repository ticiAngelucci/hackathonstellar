import {useState} from 'react';
import {router,useLocalSearchParams} from 'expo-router';
import {StyleSheet,Text,TextInput,View} from 'react-native';
import {Screen} from '@/components/Screen';
import {AppHeader} from '@/components/AppHeader';
import {PrimaryButton} from '@/components/PrimaryButton';
import {authService} from '@/services/auth/auth.service';
import {profileService} from '@/services/users/profile.service';
import {userMessage} from '@/lib/errors';
import {colors,spacing,radius,typography} from '@/constants/theme';
export default function Auth(){
 const {signup}=useLocalSearchParams<{signup?:string}>();const [creating,setCreating]=useState(signup==='true');
 const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 const submit=async()=>{if(busy)return;setBusy(true);setMessage('');try{
  const result=creating?await authService.signUp(email,password):await authService.signIn(email,password);
  if(!result.session){setMessage('Revisá tu email para confirmar la cuenta. Después iniciá sesión.');setCreating(false);return;}
  const profile=await profileService.getProfile();
  router.replace(profile?.username?'/(tabs)':'/onboarding/name');
 }catch(error){setMessage(userMessage(error));}finally{setBusy(false);}};
 return <Screen><AppHeader title={creating?'Crear cuenta':'Iniciar sesión'}/><View style={styles.card}>
 <Text style={styles.text}>Tu cuenta guarda tu perfil y tus grupos. La protección del dispositivo y la wallet se configuran por separado.</Text>
 <TextInput accessibilityLabel="Email" style={styles.input} placeholder="Email" placeholderTextColor={colors.muted} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email"/>
 <TextInput accessibilityLabel="Contraseña" style={styles.input} placeholder="Contraseña" placeholderTextColor={colors.muted} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete={creating?'new-password':'current-password'}/>
 {!!message&&<Text style={styles.text}>{message}</Text>}
 <PrimaryButton disabled={busy||!email.trim()||password.length<6} title={busy?'Un momento…':creating?'Crear cuenta':'Iniciar sesión'} onPress={()=>void submit()}/>
 <PrimaryButton disabled={busy} variant="secondary" title={creating?'Ya tengo una cuenta':'Quiero crear una cuenta'} onPress={()=>{setCreating(v=>!v);setMessage('');}}/>
 </View></Screen>;
}
const styles=StyleSheet.create({card:{gap:spacing.md},text:{...typography.body,color:colors.muted},input:{...typography.body,color:colors.text,padding:spacing.md,borderRadius:radius.md,backgroundColor:colors.surface}});
