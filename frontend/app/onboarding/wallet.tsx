import {userMessage} from '@/lib/errors';
import {DEMO_MODE} from '@/demo/demo.config';
import {useState} from 'react';
import {router} from 'expo-router';
import {ActivityIndicator,StyleSheet,Text,View,useWindowDimensions} from 'react-native';
import Animated,{useAnimatedStyle,useSharedValue,withRepeat,withSequence,withTiming} from 'react-native-reanimated';
import {PrimaryButton} from '@/components/PrimaryButton';
import {OnboardingCopy} from '@/features/onboarding/components/OnboardingCopy';
import {OnboardingPage} from '@/features/onboarding/components/OnboardingPage';
import {OnboardingPato} from '@/features/onboarding/components/OnboardingPato';
import {walletService} from '@/services/wallet';
import {colors,radius,spacing,typography} from '@/constants/theme';

export default function Wallet(){
  const {height}=useWindowDimensions();
  const [preparing,setPreparing]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const scale=useSharedValue(1);
  const pulse=useAnimatedStyle(()=>({transform:[{scale:scale.value}]}));

  const prepare=async()=>{
    if(preparing)return;
    setPreparing(true);
    setError(null);
    scale.value=withRepeat(withSequence(withTiming(1.04,{duration:450}),withTiming(.98,{duration:450})),-1,true);
    try{
      await walletService.prepareWallet();
      router.push({pathname:'/onboarding/passkey',params:DEMO_MODE?{create:'true'}:{}});
    }catch(nextError){
      setError(userMessage(nextError,'No pudimos preparar tu wallet.'));
      setPreparing(false);
      scale.value=withTiming(1);
    }
  };

  return (
    <OnboardingPage step={9} actions={<PrimaryButton disabled={preparing} title={preparing?'Preparando tu wallet...':'Crear wallet'} onPress={()=>void prepare()}/>}>
      <Animated.View style={pulse}><OnboardingPato variant="hero" size={height<700?145:190}/></Animated.View>
      <OnboardingCopy title="Ahora vamos a crear tu wallet." body="Es tuya. Nosotros no podemos mover tu plata."/>
      <View style={styles.security}>
        <View style={styles.securityIcon}><Text style={styles.lock}>🔐</Text></View>
        <View style={styles.securityCopy}><Text style={styles.securityTitle}>Autocustodial</Text><Text style={styles.securityText}>Solo vos podés autorizar movimientos.</Text></View>
      </View>
      {preparing&&<View style={styles.status}><ActivityIndicator color={colors.yellow}/><Text style={styles.statusText}>Preparando tu wallet...</Text></View>}
      {error&&<Text style={styles.error}>{error}</Text>}
    </OnboardingPage>
  );
}

const styles=StyleSheet.create({
  security:{width:'100%',marginTop:spacing.lg,padding:spacing.md,flexDirection:'row',alignItems:'center',gap:spacing.sm,borderRadius:radius.lg,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},
  securityIcon:{width:44,height:44,borderRadius:radius.md,alignItems:'center',justifyContent:'center',backgroundColor:colors.bgSoft},
  lock:{fontSize:21},
  securityCopy:{flex:1},
  securityTitle:{...typography.bodyStrong,color:colors.text},
  securityText:{...typography.caption,color:colors.muted,marginTop:1,fontWeight:'400'},
  status:{flexDirection:'row',alignItems:'center',gap:spacing.xs,marginTop:spacing.md},
  statusText:{...typography.caption,color:colors.yellow,fontWeight:'400'},
  error:{...typography.caption,color:colors.danger,textAlign:'center',marginTop:spacing.md,fontWeight:'400'},
});
