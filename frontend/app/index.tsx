import {useEffect} from 'react';
import {router} from 'expo-router';
import {Pressable,StyleSheet,Text,View,useWindowDimensions} from 'react-native';
import {Screen} from '@/components/Screen';
import {PrimaryButton} from '@/components/PrimaryButton';
import {PatoHero} from '@/components/PatoHero';
import {hasCompletedOnboarding,markOnboardingCompleted} from '@/features/onboarding/services/onboardingStorage';
import {walletMode,walletService} from '@/services/wallet';
import {colors,spacing,typography} from '@/constants/theme';

export default function Onboarding(){
  const {width,height}=useWindowDimensions();
  const compact=height<700;
  const heroSize=Math.min(width-spacing.xxxl,compact?212:292);

  useEffect(()=>{
    let active=true;
    hasCompletedOnboarding().then(async completed=>{
      if(!active||!completed)return;
      const account=walletMode==='stellar'?await walletService.getAccount().catch(()=>null):null;
      if(active)router.replace(walletMode==='stellar'&&!account?'/onboarding/name':'/(tabs)');
    }).catch(()=>{});
    return ()=>{active=false;};
  },[]);

  const enterExistingAccount=async()=>{
    if(walletMode==='stellar'){
      const account=await walletService.getAccount().catch(()=>null);
      if(!account){
        router.push('/onboarding/name');
        return;
      }
    }
    await markOnboardingCompleted();
    router.replace('/(tabs)');
  };

  return (
    <Screen scroll={false} contentStyle={[styles.screen,compact&&styles.compactScreen]}>
      <View style={styles.content}>
        <PatoHero size={heroSize} style={styles.pato}/>
        <Text style={[styles.title,compact&&styles.compactTitle]}>
          Tu agente{`\n`}
          <Text style={styles.titleAccent}>de pagos</Text>
        </Text>
        <Text style={styles.sub}>Organizá, pagá y dejá{`\n`}que Pato se encargue{`\n`}del resto.</Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.indicators}>
          <View style={[styles.dot,styles.activeDot]}/>
          <View style={styles.dot}/>
          <View style={styles.dot}/>
        </View>
        <PrimaryButton title="Comenzar" onPress={()=>router.push('/onboarding')}/>
        <Pressable onPress={()=>void enterExistingAccount()} style={({pressed})=>pressed&&styles.pressed}>
          <Text style={styles.login}>Ya tengo una cuenta</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles=StyleSheet.create({
  screen:{paddingHorizontal:spacing.xl,paddingTop:spacing.sm,paddingBottom:spacing.sm,justifyContent:'space-between'},
  compactScreen:{paddingTop:0},
  content:{alignItems:'flex-start'},
  pato:{alignSelf:'center',marginBottom:spacing.xs},
  title:{...typography.hero,color:colors.text,fontSize:38,lineHeight:39,letterSpacing:-.6},
  compactTitle:{fontSize:34,lineHeight:35},
  titleAccent:{color:colors.yellow},
  sub:{...typography.body,color:colors.text,marginTop:spacing.sm},
  footer:{gap:spacing.sm,alignItems:'center'},
  indicators:{height:8,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6},
  dot:{width:6,height:6,borderRadius:3,backgroundColor:colors.border},
  activeDot:{width:18,backgroundColor:colors.yellow},
  login:{...typography.caption,color:colors.blueBright,textAlign:'center',fontWeight:'600'},
  pressed:{opacity:.65},
});
