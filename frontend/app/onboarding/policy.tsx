import {router} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {Pressable,StyleSheet,Text,View,useWindowDimensions} from 'react-native';
import Animated,{FadeInDown} from 'react-native-reanimated';
import {PrimaryButton} from '@/components/PrimaryButton';
import {OnboardingCopy} from '@/features/onboarding/components/OnboardingCopy';
import {OnboardingPage} from '@/features/onboarding/components/OnboardingPage';
import {OnboardingPato} from '@/features/onboarding/components/OnboardingPato';
import {useOnboarding} from '@/features/onboarding/store/OnboardingProvider';
import {PolicyPreset} from '@/features/onboarding/types';
import {colors,radius,spacing,typography} from '@/constants/theme';

const presets:{id:PolicyPreset;title:string;body:string;icon:keyof typeof Ionicons.glyphMap;recommended?:boolean}[]=[
  {id:'safe',title:'Cauteloso',body:'Siempre preguntar antes de pagar.',icon:'shield-checkmark'},
  {id:'balanced',title:'Equilibrado',body:'Pato puede pagar hasta 5 USDC.',icon:'options',recommended:true},
  {id:'custom',title:'Personalizar',body:'Definir cada límite manualmente.',icon:'settings'},
];

export default function Policy(){
  const {height}=useWindowDimensions();
  const {profile,updateProfile}=useOnboarding();

  return (
    <OnboardingPage step={11} actions={<PrimaryButton title="Continuar" onPress={()=>router.push('/onboarding/notifications')}/>}>
      <OnboardingPato variant="agent" size={height<700?100:130}/>
      <OnboardingCopy title="¿Cuánta libertad me das?" body="Podés cambiar estas reglas cuando quieras."/>
      <View style={styles.options}>
        {presets.map((preset,index)=>{
          const selected=profile.policyPreset===preset.id;
          return (
            <Animated.View key={preset.id} entering={FadeInDown.delay(100+index*55).duration(280)}>
              <Pressable onPress={()=>updateProfile({policyPreset:preset.id})} style={({pressed})=>[styles.option,selected&&styles.selected,pressed&&styles.pressed]}>
                <View style={[styles.icon,selected&&styles.iconSelected]}><Ionicons name={preset.icon} size={21} color={selected?colors.black:colors.yellow}/></View>
                <View style={styles.copy}>
                  <View style={styles.titleRow}><Text style={styles.title}>{preset.title}</Text>{preset.recommended&&<Text style={styles.badge}>RECOMENDADO</Text>}</View>
                  <Text style={styles.body}>{preset.body}</Text>
                </View>
                <Ionicons name={selected?'checkmark-circle':'ellipse-outline'} size={22} color={selected?colors.yellow:colors.border}/>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </OnboardingPage>
  );
}

const styles=StyleSheet.create({
  options:{width:'100%',gap:spacing.xs,marginTop:spacing.lg},
  option:{minHeight:72,flexDirection:'row',alignItems:'center',gap:spacing.sm,padding:spacing.sm,borderRadius:radius.md,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},
  selected:{borderColor:colors.yellow,backgroundColor:'rgba(255,198,26,.06)'},
  pressed:{opacity:.75,transform:[{scale:.99}]},
  icon:{width:42,height:42,borderRadius:radius.md,alignItems:'center',justifyContent:'center',backgroundColor:colors.bgSoft},
  iconSelected:{backgroundColor:colors.yellow},
  copy:{flex:1},
  titleRow:{flexDirection:'row',alignItems:'center',gap:spacing.xs},
  title:{...typography.bodyStrong,color:colors.text},
  badge:{fontSize:8,lineHeight:11,color:colors.yellow,fontWeight:'900'},
  body:{...typography.caption,color:colors.muted,marginTop:2,fontWeight:'400'},
});
