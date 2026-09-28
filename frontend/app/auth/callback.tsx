import {useCallback,useEffect,useRef,useState} from 'react';
import * as Linking from 'expo-linking';
import {router} from 'expo-router';
import {StyleSheet,Text,View} from 'react-native';
import {Screen} from '@/components/Screen';
import {PrimaryButton} from '@/components/PrimaryButton';
import {env} from '@/config/env';
import {AppError} from '@/lib/errors';
import {authService} from '@/services/auth/auth.service';
import {profileService} from '@/services/users/profile.service';
import {colors,radius,spacing,typography} from '@/constants/theme';

type Phase='confirming'|'success'|'error';

export default function AuthCallback(){
  const liveUrl=Linking.useLinkingURL();
  const started=useRef(false);
  const sessionReady=useRef(false);
  const [phase,setPhase]=useState<Phase>('confirming');
  const [message,setMessage]=useState('Confirmando tu cuenta…');
  const [errorCode,setErrorCode]=useState<string>();
  const retryable=['network','confirmation_failed','profile_load'].includes(errorCode??'');

  const finish=useCallback(async()=>{
    setPhase('confirming');setMessage(sessionReady.current?'Cargando tu perfil…':'Confirmando tu cuenta…');setErrorCode(undefined);
    try{
      if(env.demoMode)throw new AppError('La confirmación de email no está disponible en modo demo.','unsupported');
      if(!sessionReady.current){
        const initialUrl=liveUrl??await Linking.getInitialURL();
        if(!initialUrl)throw new AppError('No pudimos leer este enlace de confirmación.','missing_callback_params');
        await authService.completeEmailConfirmation(initialUrl);
        sessionReady.current=true;
      }
      setPhase('success');setMessage('Tu cuenta fue confirmada.');
      const profile=await profileService.getProfile();
      router.replace(profile?.username?'/(tabs)':'/onboarding/name');
    }catch(error){
      const known=sessionReady.current
        ?new AppError('Tu cuenta fue confirmada, pero no pudimos cargar tu perfil. Reintentá.','profile_load')
        :error instanceof AppError?error:new AppError('No pudimos confirmar tu cuenta. Reintentá.');
      setErrorCode(known.code);setMessage(known.message);setPhase('error');
    }
  },[liveUrl]);

  useEffect(()=>{if(started.current)return;started.current=true;void finish();},[finish]);

  return <Screen scroll={false} contentStyle={styles.screen}>
    <View style={styles.card}>
      <Text style={styles.eyebrow}>PATO PAY</Text>
      <Text style={styles.title}>{phase==='success'?'Cuenta confirmada':phase==='error'?'No pudimos continuar':'Confirmando tu cuenta…'}</Text>
      <Text style={[styles.message,phase==='error'&&styles.error]}>{message}</Text>
      {phase==='error'&&<View style={styles.actions}>
        {retryable
          ?<PrimaryButton title="Reintentar" onPress={()=>void finish()}/>
          :<PrimaryButton title={errorCode==='already_confirmed'?'Iniciar sesión':'Volver a iniciar sesión'} onPress={()=>router.replace('/auth')}/>
        }
        {retryable&&(
          <PrimaryButton variant="secondary" title="Volver al inicio" onPress={()=>router.replace('/auth')}/>
        )}
      </View>}
    </View>
  </Screen>;
}

const styles=StyleSheet.create({
  screen:{justifyContent:'center'},
  card:{gap:spacing.md,padding:spacing.lg,borderRadius:radius.lg,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},
  eyebrow:{...typography.caption,color:colors.yellow,fontWeight:'900',letterSpacing:1.2},
  title:{...typography.h2,color:colors.text},
  message:{...typography.body,color:colors.muted},
  error:{color:colors.danger},
  actions:{gap:spacing.sm,marginTop:spacing.sm},
});
