import {PropsWithChildren,ReactNode} from 'react';
import {router} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {KeyboardAvoidingView,Platform,Pressable,StyleSheet,View} from 'react-native';
import Animated,{FadeInLeft,FadeInRight,FadeInUp} from 'react-native-reanimated';
import {Screen} from '@/components/Screen';
import {OnboardingPato} from '@/features/onboarding/components/OnboardingPato';
import {colors,radius,spacing} from '@/constants/theme';

type OnboardingShellProps=PropsWithChildren<{
  progress:number;
  actions:ReactNode;
  onBack?:()=>void;
  showBack?:boolean;
  transitionKey?:string|number;
  direction?:'forward'|'back';
  patoVariant?:Parameters<typeof OnboardingPato>[0]['variant'];
  patoSize?:number;
}>;

export function OnboardingShell({
  progress,
  actions,
  onBack,
  showBack=true,
  transitionKey='page',
  direction='forward',
  patoVariant,
  patoSize=150,
  children,
}:OnboardingShellProps){
  const safeProgress=Math.max(0,Math.min(1,progress));
  const entering=direction==='forward'?FadeInRight.duration(300):FadeInLeft.duration(300);

  return (
    <Screen scroll={false} contentStyle={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={styles.keyboard}>
        <View style={styles.header}>
          {showBack?(
            <Pressable accessibilityLabel="Volver" onPress={onBack??(()=>router.back())} style={({pressed})=>[styles.back,pressed&&styles.pressed]}>
              <Ionicons name="chevron-back" size={21} color={colors.text}/>
            </Pressable>
          ):<View style={styles.back}/>}
          <View style={styles.progressTrack}>
            <Animated.View entering={FadeInUp.duration(240)} style={[styles.progressFill,{width:`${Math.round(safeProgress*100)}%`}]}/>
          </View>
          <View style={styles.back}/>
        </View>

        <Animated.View key={transitionKey} entering={entering} style={styles.content}>
          {patoVariant&&<OnboardingPato key={`${transitionKey}-${patoVariant}`} variant={patoVariant} size={patoSize}/>}
          {children}
        </Animated.View>

        <View style={styles.actions}>{actions}</View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles=StyleSheet.create({
  screen:{paddingHorizontal:spacing.lg,paddingTop:spacing.xxs,paddingBottom:spacing.md},
  keyboard:{flex:1},
  header:{height:46,flexDirection:'row',alignItems:'center',gap:spacing.sm},
  back:{width:38,height:38,borderRadius:radius.pill,alignItems:'center',justifyContent:'center'},
  pressed:{opacity:.65},
  progressTrack:{flex:1,height:5,borderRadius:radius.pill,overflow:'hidden',backgroundColor:colors.border},
  progressFill:{height:'100%',borderRadius:radius.pill,backgroundColor:colors.yellow},
  content:{flex:1,width:'100%',alignItems:'center',justifyContent:'center'},
  actions:{gap:spacing.xs},
});
