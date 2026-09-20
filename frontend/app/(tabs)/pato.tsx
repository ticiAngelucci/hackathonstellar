import {useEffect} from 'react';
import {router} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {StyleSheet,Text,View} from 'react-native';
import Animated,{FadeInDown,cancelAnimation,useAnimatedStyle,useSharedValue,withRepeat,withSequence,withTiming} from 'react-native-reanimated';
import {Screen} from '@/components/Screen';
import {PatoAgent} from '@/components/PatoAgent';
import {AnimatedCard} from '@/components/AnimatedCard';
import {SectionHeader} from '@/components/SectionHeader';
import {colors,radius,spacing,typography} from '@/constants/theme';

const actions=[
  {title:'Mis reglas',subtitle:'Límites y permisos de pago',icon:'options' as const,route:'/permissions' as const},
  {title:'Automatizaciones',subtitle:'Servicios que Pato paga por vos',icon:'flash' as const,route:'/services' as const},
];

export default function Pato(){
  const floatY=useSharedValue(0);
  const floating=useAnimatedStyle(()=>({transform:[{translateY:floatY.value}]}));

  useEffect(()=>{
    floatY.value=withRepeat(
      withSequence(
        withTiming(-6,{duration:1600}),
        withTiming(0,{duration:1600}),
      ),
      -1,
    );
    return ()=>cancelAnimation(floatY);
  },[floatY]);

  return (
    <Screen contentStyle={s.screen}>
      <View style={s.hero}>
        <Animated.View entering={FadeInDown.duration(420)} style={floating}>
          <PatoAgent size={190}/>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(100).duration(320)} style={s.badge}>
          <View style={s.dot}/>
          <Text style={s.badgeText}>AGENTE ACTIVO</Text>
        </Animated.View>
        <Animated.Text entering={FadeInDown.delay(150).duration(320)} style={s.title}>Hola, soy Pato.</Animated.Text>
        <Animated.Text entering={FadeInDown.delay(200).duration(320)} style={s.sub}>Vos ponés las reglas. Yo me ocupo del resto.</Animated.Text>
      </View>

      <SectionHeader title="¿Qué hacemos?"/>
      <View style={s.actions}>
        {actions.map((action,index)=>(
          <AnimatedCard key={action.title} delay={260+index*70} style={s.card} onPress={()=>router.push(action.route)}>
            <View style={s.icon}>
              <Ionicons name={action.icon} size={22} color={colors.yellow}/>
            </View>
            <View style={s.copy}>
              <Text style={s.cardTitle}>{action.title}</Text>
              <Text style={s.cardSub}>{action.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={19} color={colors.muted}/>
          </AnimatedCard>
        ))}
      </View>
    </Screen>
  );
}

const s=StyleSheet.create({
  screen:{paddingTop:spacing.sm},
  hero:{alignItems:'center',paddingBottom:spacing.xl},
  badge:{flexDirection:'row',alignItems:'center',gap:7,marginTop:-spacing.xxs,backgroundColor:colors.surface,borderRadius:radius.pill,paddingHorizontal:spacing.sm,paddingVertical:7,borderWidth:1,borderColor:colors.border},
  dot:{width:7,height:7,borderRadius:4,backgroundColor:colors.success},
  badgeText:{...typography.caption,color:colors.success,fontSize:10,fontWeight:'900',letterSpacing:.8},
  title:{...typography.h1,color:colors.text,marginTop:spacing.md},
  sub:{...typography.body,color:colors.muted,textAlign:'center',marginTop:spacing.xs,maxWidth:290},
  actions:{gap:spacing.xs},
  card:{padding:spacing.md,flexDirection:'row',alignItems:'center',gap:spacing.sm,borderRadius:radius.md},
  icon:{width:46,height:46,borderRadius:radius.md,alignItems:'center',justifyContent:'center',backgroundColor:colors.bgSoft},
  copy:{flex:1},
  cardTitle:{...typography.bodyStrong,color:colors.text,fontWeight:'800'},
  cardSub:{...typography.caption,color:colors.muted,marginTop:2},
});
