import {DEMO_MODE} from '@/demo/demo.config';
import {useState} from 'react';
import {router} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {StyleSheet,Text,View,useWindowDimensions} from 'react-native';
import * as Notifications from 'expo-notifications';
import {PrimaryButton} from '@/components/PrimaryButton';
import {SecondaryButton} from '@/components/SecondaryButton';
import {OnboardingCopy} from '@/features/onboarding/components/OnboardingCopy';
import {OnboardingPage} from '@/features/onboarding/components/OnboardingPage';
import {OnboardingPato} from '@/features/onboarding/components/OnboardingPato';
import {useOnboarding} from '@/features/onboarding/store/OnboardingProvider';
import {colors,radius,spacing,typography} from '@/constants/theme';

export default function NotificationPermission(){
  const {height}=useWindowDimensions();
  const {updateProfile}=useOnboarding();
  const [requesting,setRequesting]=useState(false);
  const [error,setError]=useState<string|null>(null);

  const next=(enabled:boolean)=>{
    updateProfile({notificationsEnabled:enabled});
    router.push('/onboarding/app-lock');
  };

  const activate=async()=>{
    setRequesting(true);
    setError(null);
    try{
      const result=DEMO_MODE?{status:'granted'}:await Notifications.requestPermissionsAsync();
      next(result.status==='granted');
    }catch(nextError){
      setError(nextError instanceof Error?nextError.message:'No pudimos pedir el permiso.');
      setRequesting(false);
    }
  };

  return (
    <OnboardingPage
      step={12}
      actions={(
        <>
          <PrimaryButton disabled={requesting} icon="notifications" title={requesting?'Esperando permiso…':'Activar notificaciones'} onPress={()=>void activate()}/>
          <SecondaryButton title="Ahora no" onPress={()=>next(false)}/>
        </>
      )}
    >
      <OnboardingPato variant="approval" size={height<700?135:180}/>
      <OnboardingCopy title="¿Te aviso cuando haya algo para pagar?" body="Solo vamos a escribirte cuando realmente necesites hacer algo."/>
      <View style={styles.preview}>
        <View style={styles.icon}><Ionicons name="notifications" size={23} color={colors.yellow}/></View>
        <View style={styles.copy}><Text style={styles.app}>Pato Pay</Text><Text style={styles.message}>Tenés un pago esperando tu aprobación.</Text></View>
        <Text style={styles.time}>ahora</Text>
      </View>
      {error&&<Text style={styles.error}>{error}</Text>}
    </OnboardingPage>
  );
}

const styles=StyleSheet.create({
  preview:{width:'100%',marginTop:spacing.xl,padding:spacing.md,flexDirection:'row',alignItems:'center',gap:spacing.sm,borderRadius:radius.lg,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},
  icon:{width:44,height:44,borderRadius:radius.md,alignItems:'center',justifyContent:'center',backgroundColor:colors.bgSoft},
  copy:{flex:1},
  app:{...typography.caption,color:colors.text},
  message:{...typography.caption,color:colors.muted,marginTop:2,fontWeight:'400'},
  time:{fontSize:9,lineHeight:12,color:colors.muted,alignSelf:'flex-start'},
  error:{...typography.caption,color:colors.danger,textAlign:'center',marginTop:spacing.sm,fontWeight:'400'},
});
