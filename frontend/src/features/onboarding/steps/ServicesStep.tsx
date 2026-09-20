import {useEffect} from 'react';
import {Ionicons} from '@expo/vector-icons';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import Animated,{FadeInDown,ZoomIn,useAnimatedStyle,useSharedValue,withSpring} from 'react-native-reanimated';
import {PatoSpeech} from '@/features/onboarding/components/PatoSpeech';
import {colors,radius,spacing,typography} from '@/constants/theme';

const services=[
  {id:'spotify',name:'Spotify',icon:'musical-notes' as const},
  {id:'netflix',name:'Netflix',icon:'play-circle' as const},
  {id:'internet',name:'Internet',icon:'wifi' as const},
  {id:'chatgpt',name:'ChatGPT',icon:'sparkles' as const},
];

function ServiceToggle({active}:{active:boolean}){
  const position=useSharedValue(active?18:0);
  const animatedStyle=useAnimatedStyle(()=>({transform:[{translateX:position.value}]}));
  useEffect(()=>{position.value=withSpring(active?18:0,{damping:17,stiffness:220});},[active,position]);

  return (
    <View style={[styles.toggle,active&&styles.toggleActive]}>
      <Animated.View style={[styles.thumb,active&&styles.thumbActive,animatedStyle]}>
        {active&&<Animated.View entering={ZoomIn.duration(180)}><Ionicons name="checkmark" size={11} color={colors.black}/></Animated.View>}
      </Animated.View>
    </View>
  );
}

export function ServicesStep({enabled,onToggle}:{enabled:string[];onToggle:(id:string)=>void}){
  return (
    <>
      <PatoSpeech>También puedo ocuparme de las cosas aburridas.</PatoSpeech>
      <View style={styles.list}>
        {services.map((service,index)=>{
          const active=enabled.includes(service.id);
          return (
            <Animated.View key={service.id} entering={FadeInDown.delay(70+index*70).duration(280)}>
              <Pressable onPress={()=>onToggle(service.id)} style={({pressed})=>[styles.service,active&&styles.activeService,pressed&&styles.pressed]}>
                <View style={styles.icon}><Ionicons name={service.icon} size={19} color={active?colors.yellow:colors.muted}/></View>
                <Text style={styles.name}>{service.name}</Text>
                <ServiceToggle active={active}/>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
      {enabled.length>0&&(
        <Animated.View entering={FadeInDown.springify().damping(16)} style={styles.feedback}>
          <Ionicons name="flash" size={17} color={colors.yellow}/><Text style={styles.feedbackText}><Text style={styles.feedbackStrong}>Pagos automáticos</Text>{`\n`}Vos decidís qué servicios puedo pagar por vos.</Text>
        </Animated.View>
      )}
    </>
  );
}

const styles=StyleSheet.create({
  list:{width:'100%',gap:spacing.xs,marginTop:spacing.md},
  service:{minHeight:52,flexDirection:'row',alignItems:'center',gap:spacing.sm,paddingHorizontal:spacing.sm,borderRadius:radius.md,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},
  activeService:{borderColor:'rgba(255,198,26,.55)'},
  pressed:{opacity:.72,transform:[{scale:.99}]},
  icon:{width:34,height:34,borderRadius:radius.sm,alignItems:'center',justifyContent:'center',backgroundColor:colors.bgSoft},
  name:{...typography.bodyStrong,color:colors.text,flex:1},
  toggle:{width:42,height:24,padding:3,borderRadius:radius.pill,justifyContent:'center',backgroundColor:colors.border},
  toggleActive:{backgroundColor:colors.yellow},
  thumb:{width:18,height:18,borderRadius:radius.pill,alignItems:'center',justifyContent:'center',backgroundColor:colors.muted},
  thumbActive:{backgroundColor:colors.text},
  feedback:{width:'100%',marginTop:spacing.sm,padding:spacing.sm,flexDirection:'row',alignItems:'center',gap:spacing.sm,borderRadius:radius.md,backgroundColor:'rgba(255,198,26,.08)'},
  feedbackText:{...typography.caption,color:colors.muted,flex:1,fontWeight:'400'},
  feedbackStrong:{color:colors.yellow,fontWeight:'800'},
});
