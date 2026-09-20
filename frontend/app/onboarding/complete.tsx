import {useEffect,useState} from 'react';
import {router} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {StyleSheet,Text,View,useWindowDimensions} from 'react-native';
import Animated,{FadeInDown} from 'react-native-reanimated';
import {PrimaryButton} from '@/components/PrimaryButton';
import {OnboardingCopy} from '@/features/onboarding/components/OnboardingCopy';
import {OnboardingPage} from '@/features/onboarding/components/OnboardingPage';
import {OnboardingPato} from '@/features/onboarding/components/OnboardingPato';
import {markOnboardingCompleted} from '@/features/onboarding/services/onboardingStorage';
import {useOnboarding} from '@/features/onboarding/store/OnboardingProvider';
import {isAppLockEnabled} from '@/services/security/local-auth.service';
import {walletMode} from '@/services/wallet';
import {colors,radius,spacing,typography} from '@/constants/theme';

const statuses=[
  {label:'Wallet activa',field:'wallet' as const},
  {label:'Passkey activa',field:'passkey' as const},
  {label:'Reglas configuradas',field:'policy' as const},
];

export default function Complete(){
  const {height}=useWindowDimensions();
  const {profile}=useOnboarding();
  const [finishing,setFinishing]=useState(false);
  const [appLockEnabled,setAppLockState]=useState(false);
  const realWalletReady=profile.walletStatus==='active'&&profile.passkeyCreated;
  const ready=walletMode==='mock'?profile.walletCreated:realWalletReady;

  useEffect(()=>{void isAppLockEnabled().then(setAppLockState).catch(()=>setAppLockState(false));},[]);

  const finish=async()=>{
    setFinishing(true);
    await markOnboardingCompleted();
    router.replace('/(tabs)');
  };

  return (
    <OnboardingPage step={14} actions={<PrimaryButton disabled={finishing||!ready} title={finishing?'Entrando…':'Entrar a Pato Pay'} onPress={()=>void finish()}/>}>
      <OnboardingPato variant="success" size={height<700?145:195}/>
      <OnboardingCopy title="Estamos listos." body="El acceso a la app y la autorización de tu wallet funcionan por separado."/>
      <View style={styles.statuses}>
        <Text style={styles.sectionLabel}>{walletMode==='mock'?'WALLET · MODO DEMO':'WALLET · STELLAR TESTNET'}</Text>
        {statuses.map((status,index)=>{
          const active=status.field==='wallet'?profile.walletStatus==='active':status.field==='passkey'?profile.passkeyCreated:Boolean(profile.policyPreset);
          const label=walletMode==='mock'&&status.field==='wallet'
            ?'Wallet real pendiente'
            :walletMode==='mock'&&status.field==='passkey'
              ?'Passkey real pendiente'
              :status.label;
          return (
            <Animated.View key={status.label} entering={FadeInDown.delay(120+index*60).duration(280)} style={styles.status}>
              <View style={[styles.check,!active&&styles.checkPending]}><Ionicons name={active?'checkmark':'ellipsis-horizontal'} size={16} color={active?colors.bg:colors.muted}/></View>
              <Text style={styles.statusText}>{label}</Text>
            </Animated.View>
          );
        })}
        {profile.walletAddress&&<Text numberOfLines={1} style={styles.address}>{profile.walletAddress.slice(0,10)}…{profile.walletAddress.slice(-8)}</Text>}
        <Text style={styles.sectionLabel}>ACCESO A LA APP</Text>
        <View style={styles.status}>
          <View style={[styles.check,!appLockEnabled&&styles.optional]}><Ionicons name={appLockEnabled?'lock-closed':'remove'} size={14} color={appLockEnabled?colors.bg:colors.muted}/></View>
          <Text style={styles.statusText}>{appLockEnabled?'Pato Pay protegido':'Protección opcional no activada'}</Text>
        </View>
      </View>
    </OnboardingPage>
  );
}

const styles=StyleSheet.create({
  statuses:{width:'100%',marginTop:spacing.lg,padding:spacing.sm,borderRadius:radius.lg,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},
  sectionLabel:{fontSize:8,lineHeight:11,color:colors.muted,fontWeight:'900',letterSpacing:1,paddingHorizontal:spacing.xs,paddingTop:spacing.xs},
  status:{minHeight:44,flexDirection:'row',alignItems:'center',gap:spacing.sm,paddingHorizontal:spacing.xs},
  check:{width:26,height:26,borderRadius:radius.pill,alignItems:'center',justifyContent:'center',backgroundColor:colors.success},
  checkPending:{backgroundColor:colors.bgSoft},
  optional:{backgroundColor:colors.bgSoft},
  statusText:{...typography.bodyStrong,color:colors.text},
  address:{...typography.caption,color:colors.blueBright,textAlign:'center',paddingTop:spacing.xs,borderTopWidth:1,borderTopColor:colors.border,fontWeight:'400'},
});
