import {DEMO_MODE} from '@/demo/demo.config';
import {useEffect} from 'react';
import {Ionicons} from '@expo/vector-icons';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import Animated,{FadeInDown,useAnimatedStyle,useSharedValue,withSpring} from 'react-native-reanimated';
import {PatoSpeech} from '@/features/onboarding/components/PatoSpeech';
import {colors,radius,spacing,typography} from '@/constants/theme';

const AnimatedPressable=Animated.createAnimatedComponent(Pressable);

export function BalanceStep({active,onActivate}:{active:boolean;onActivate:()=>void}){
  const scale=useSharedValue(1);
  const growth=useSharedValue(active?1:0);
  const cardStyle=useAnimatedStyle(()=>({transform:[{scale:scale.value}]}));
  const barStyle=useAnimatedStyle(()=>({transform:[{scaleY:growth.value}]}));

  useEffect(()=>{growth.value=withSpring(active?1:0,{damping:14,stiffness:120});},[active,growth]);

  const activate=()=>{
    scale.value=withSpring(.97,{},()=>{scale.value=withSpring(1);});
    onActivate();
  };

  return (
    <>
      <PatoSpeech>Primero: tu plata no tiene por qué quedarse quieta.</PatoSpeech>
      <AnimatedPressable accessibilityRole="button" onPress={activate} style={[styles.balanceCard,active&&styles.activeCard,cardStyle]}>
        <View>
          <Text style={styles.example}>{DEMO_MODE?'TU SALDO':'EJEMPLO'}</Text>
          <Text style={styles.balance}>100 <Text style={styles.asset}>USDC</Text></Text>
          <Text style={styles.hint}>{DEMO_MODE?(active?'+ rendimiento':'Tocá tu saldo para activarlo'):'Staking disponible próximamente'}</Text>
        </View>
        <View style={styles.chart}>
          {[18,29,42,56].map((height,index)=><Animated.View key={height} style={[styles.bar,{height,opacity:.45+index*.15},barStyle]}/>) }
        </View>
      </AnimatedPressable>
      {active&&(
        <Animated.View entering={FadeInDown.springify().damping(15)} style={styles.feedback}>
          <Ionicons name="leaf" size={18} color={colors.success}/>
          <View style={styles.feedbackCopy}><Text style={styles.feedbackTitle}>{DEMO_MODE?'Staking activo':'Disponible próximamente'}</Text><Text style={styles.feedbackText}>{DEMO_MODE?'Mientras no la usás, tu saldo puede generar rendimiento.':'Esta función todavía no está habilitada.'}</Text></View>
        </Animated.View>
      )}
      {!DEMO_MODE&&<Text style={styles.disclaimer}>Ejemplo educativo. No implica rendimiento garantizado.</Text>}
    </>
  );
}

const styles=StyleSheet.create({
  balanceCard:{width:'100%',marginTop:spacing.md,padding:spacing.lg,flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',borderRadius:radius.lg,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},
  activeCard:{borderColor:colors.success},
  example:{fontSize:9,lineHeight:12,fontWeight:'900',letterSpacing:1,color:colors.muted},
  balance:{fontSize:34,lineHeight:41,fontWeight:'900',color:colors.text,marginTop:spacing.xxs},
  asset:{fontSize:14,lineHeight:20},
  hint:{...typography.caption,color:colors.muted,marginTop:spacing.xs,fontWeight:'400'},
  chart:{height:62,flexDirection:'row',alignItems:'flex-end',gap:5},
  bar:{width:7,borderRadius:radius.pill,backgroundColor:colors.success,transformOrigin:'bottom'},
  feedback:{width:'100%',marginTop:spacing.sm,padding:spacing.sm,flexDirection:'row',alignItems:'center',gap:spacing.sm,borderRadius:radius.md,backgroundColor:'rgba(30,215,164,.1)',borderWidth:1,borderColor:'rgba(30,215,164,.28)'},
  feedbackCopy:{flex:1},
  feedbackTitle:{...typography.bodyStrong,color:colors.success},
  feedbackText:{...typography.caption,color:colors.muted,marginTop:1,fontWeight:'400'},
  disclaimer:{fontSize:9,lineHeight:13,color:colors.muted,textAlign:'center',marginTop:spacing.xs},
});
