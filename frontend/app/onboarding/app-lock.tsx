import {useEffect,useState} from 'react';
import {router} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {Platform,Pressable,StyleSheet,Text,View,useWindowDimensions} from 'react-native';
import {AuthenticationType} from 'expo-local-authentication';
import {PrimaryButton} from '@/components/PrimaryButton';
import {OnboardingCopy} from '@/features/onboarding/components/OnboardingCopy';
import {OnboardingPage} from '@/features/onboarding/components/OnboardingPage';
import {OnboardingPato} from '@/features/onboarding/components/OnboardingPato';
import {
  AppAuthenticationMode,
  authenticate,
  getSupportedAuthenticationTypes,
  isBiometricAvailable,
  isDeviceSecurityAvailable,
  setAppLockEnabled,
} from '@/services/security/local-auth.service';
import {colors,radius,spacing,typography} from '@/constants/theme';

function biometricLabel(types:AuthenticationType[]){
  if(Platform.OS==='ios'){
    if(types.includes(AuthenticationType.FACIAL_RECOGNITION))return 'Usar Face ID';
    if(types.includes(AuthenticationType.FINGERPRINT))return 'Usar Touch ID';
  }
  return 'Usar biometría';
}

function authError(error?:string){
  if(error==='user_cancel'||error==='app_cancel'||error==='system_cancel')return 'No activamos la protección porque cancelaste la verificación.';
  if(error==='not_enrolled')return 'Primero configurá biometría o bloqueo de pantalla en tu dispositivo.';
  if(error==='lockout')return 'La seguridad del dispositivo está bloqueada temporalmente.';
  return 'No pudimos verificar la seguridad del dispositivo.';
}

export default function AppLock(){
  const {height}=useWindowDimensions();
  const [checking,setChecking]=useState(true);
  const [biometricAvailable,setBiometricAvailable]=useState(false);
  const [deviceSecurityAvailable,setDeviceSecurityAvailable]=useState(false);
  const [types,setTypes]=useState<AuthenticationType[]>([]);
  const [authenticating,setAuthenticating]=useState<AppAuthenticationMode|null>(null);
  const [error,setError]=useState<string|null>(null);

  useEffect(()=>{
    let active=true;
    Promise.all([
      isBiometricAvailable(),
      isDeviceSecurityAvailable(),
      getSupportedAuthenticationTypes(),
    ]).then(([biometric,deviceSecurity,supportedTypes])=>{
      if(!active)return;
      setBiometricAvailable(biometric);
      setDeviceSecurityAvailable(deviceSecurity);
      setTypes(supportedTypes);
    }).catch(()=>{
      if(active)setError('No pudimos consultar la seguridad del dispositivo.');
    }).finally(()=>{if(active)setChecking(false);});
    return ()=>{active=false;};
  },[]);

  const enable=async(mode:AppAuthenticationMode)=>{
    setAuthenticating(mode);
    setError(null);
    try{
      const result=await authenticate(mode);
      if(!result.success){
        setError(authError(result.error));
        return;
      }
      await setAppLockEnabled(true);
      router.push('/onboarding/complete');
    }catch{
      setError('No pudimos activar la protección de Pato Pay.');
    }finally{
      setAuthenticating(null);
    }
  };

  const skip=async()=>{
    await setAppLockEnabled(false);
    router.push('/onboarding/complete');
  };

  return (
    <OnboardingPage
      step={13}
      actions={(
        <>
          <PrimaryButton
            disabled={checking||!biometricAvailable||authenticating!==null}
            icon="finger-print"
            title={authenticating==='biometric'?'Verificando…':biometricAvailable?biometricLabel(types):'Biometría no disponible'}
            onPress={()=>void enable('biometric')}
          />
          <PrimaryButton
            disabled={checking||!deviceSecurityAvailable||authenticating!==null}
            icon="phone-portrait-outline"
            title={authenticating==='device'?'Verificando…':'Usar seguridad del dispositivo'}
            variant="secondary"
            onPress={()=>void enable('device')}
          />
          <Pressable disabled={authenticating!==null} onPress={()=>void skip()} style={({pressed})=>[styles.skip,pressed&&styles.pressed]}>
            <Text style={styles.skipText}>Ahora no</Text>
          </Pressable>
        </>
      )}
    >
      <OnboardingPato variant="agent" size={height<700?115:150}/>
      <OnboardingCopy title="¿Querés proteger Pato Pay?" body="Podés pedir una verificación cada vez que abrís la aplicación."/>
      <View style={styles.explanation}>
        <View style={styles.icon}><Ionicons name="lock-closed" size={21} color={colors.yellow}/></View>
        <View style={styles.copy}>
          <Text style={styles.explanationTitle}>Protección de acceso</Text>
          <Text style={styles.explanationText}>Esto solo desbloquea Pato Pay. No firma pagos ni reemplaza la protección de tu wallet.</Text>
        </View>
      </View>
      {error&&<Text style={styles.error}>{error}</Text>}
    </OnboardingPage>
  );
}

const styles=StyleSheet.create({
  explanation:{width:'100%',marginTop:spacing.lg,padding:spacing.md,flexDirection:'row',alignItems:'center',gap:spacing.sm,borderRadius:radius.lg,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},
  icon:{width:44,height:44,borderRadius:radius.md,alignItems:'center',justifyContent:'center',backgroundColor:colors.bgSoft},
  copy:{flex:1},
  explanationTitle:{...typography.bodyStrong,color:colors.text},
  explanationText:{...typography.caption,color:colors.muted,marginTop:2,fontWeight:'400'},
  error:{...typography.caption,color:colors.danger,textAlign:'center',marginTop:spacing.sm,fontWeight:'400'},
  skip:{height:36,alignItems:'center',justifyContent:'center'},
  skipText:{...typography.caption,color:colors.muted},
  pressed:{opacity:.6},
});
