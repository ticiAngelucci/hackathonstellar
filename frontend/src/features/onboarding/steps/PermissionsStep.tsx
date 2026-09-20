import {Ionicons} from '@expo/vector-icons';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import Animated,{FadeInDown} from 'react-native-reanimated';
import {PatoSpeech} from '@/features/onboarding/components/PatoSpeech';
import {PolicyPreset} from '@/features/onboarding/types';
import {colors,radius,spacing,typography} from '@/constants/theme';

const examples=[
  {amount:'3 USDC',label:'Pato paga solo',color:colors.success},
  {amount:'10 USDC',label:'Te pregunta',color:colors.yellow},
  {amount:'100 USDC',label:'Bloqueado',color:colors.danger},
];
const presets:{id:PolicyPreset;label:string}[]=[
  {id:'safe',label:'Cauteloso'},
  {id:'balanced',label:'Equilibrado'},
  {id:'custom',label:'Personalizar'},
];

export function PermissionsStep({selected,onSelect}:{selected:PolicyPreset;onSelect:(preset:PolicyPreset)=>void}){
  return (
    <>
      <PatoSpeech>Pero no hago lo que quiero. Vos ponés las reglas.</PatoSpeech>
      <View style={styles.examples}>
        {examples.map((example,index)=>(
          <Animated.View key={example.amount} entering={FadeInDown.delay(70+index*55).duration(260)} style={styles.example}>
            <Text style={styles.amount}>{example.amount}</Text>
            <Ionicons name="arrow-forward" size={15} color={colors.muted}/>
            <View style={[styles.dot,{backgroundColor:example.color}]}/>
            <Text style={[styles.exampleLabel,{color:example.color}]}>{example.label}</Text>
          </Animated.View>
        ))}
      </View>
      <Text style={styles.choose}>Elegí cómo querés empezar</Text>
      <View style={styles.presets}>
        {presets.map(preset=>{
          const active=selected===preset.id;
          return (
            <Pressable key={preset.id} onPress={()=>onSelect(preset.id)} style={({pressed})=>[styles.preset,active&&styles.activePreset,pressed&&styles.pressed]}>
              <Text style={[styles.presetText,active&&styles.activePresetText]}>{preset.label}</Text>
              {preset.id==='balanced'&&<Text style={[styles.recommended,active&&styles.recommendedActive]}>RECOMENDADO</Text>}
            </Pressable>
          );
        })}
      </View>
      <Animated.Text key={selected} entering={FadeInDown.duration(220)} style={styles.feedback}>
        {selected==='safe'?'Siempre te voy a preguntar.':selected==='balanced'?'Puedo resolver pagos pequeños; el resto te lo consulto.':'Después elegís cada límite a tu manera.'}
      </Animated.Text>
    </>
  );
}

const styles=StyleSheet.create({
  examples:{width:'100%',marginTop:spacing.md,padding:spacing.sm,borderRadius:radius.lg,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},
  example:{minHeight:37,flexDirection:'row',alignItems:'center',gap:spacing.xs},
  amount:{...typography.caption,color:colors.text,minWidth:62},
  dot:{width:8,height:8,borderRadius:4},
  exampleLabel:{...typography.caption,flex:1},
  choose:{...typography.caption,color:colors.muted,alignSelf:'flex-start',marginTop:spacing.md},
  presets:{width:'100%',flexDirection:'row',gap:6,marginTop:spacing.xs},
  preset:{flex:1,minHeight:55,alignItems:'center',justifyContent:'center',paddingHorizontal:4,borderRadius:radius.md,backgroundColor:colors.bgSoft,borderWidth:1,borderColor:colors.border},
  activePreset:{backgroundColor:colors.yellow,borderColor:colors.yellow},
  pressed:{opacity:.72,transform:[{scale:.98}]},
  presetText:{fontSize:10,lineHeight:14,fontWeight:'800',color:colors.text},
  activePresetText:{color:colors.black},
  recommended:{fontSize:6,lineHeight:9,fontWeight:'900',color:colors.yellow,marginTop:2},
  recommendedActive:{color:colors.blue},
  feedback:{...typography.caption,color:colors.muted,textAlign:'center',marginTop:spacing.sm,fontWeight:'400'},
});
