import {Ionicons} from '@expo/vector-icons';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import Animated,{FadeInDown,Layout} from 'react-native-reanimated';
import {PatoSpeech} from '@/features/onboarding/components/PatoSpeech';
import {colors,radius,spacing,typography} from '@/constants/theme';

export type FundChoice='Viaje'|'Casa'|'Asado'|'Proyecto';
const choices:FundChoice[]=['Viaje','Casa','Asado','Proyecto'];

export function SharedFundStep({selected,onSelect}:{selected:FundChoice|null;onSelect:(choice:FundChoice)=>void}){
  return (
    <>
      <PatoSpeech>¿Compartís gastos con otras personas?</PatoSpeech>
      <View style={styles.choices}>
        {choices.map((choice,index)=>(
          <Animated.View key={choice} entering={FadeInDown.delay(70+index*45).duration(260)} style={styles.choiceWrap}>
            <Pressable onPress={()=>onSelect(choice)} style={({pressed})=>[styles.choice,selected===choice&&styles.choiceSelected,pressed&&styles.pressed]}>
              <Text style={[styles.choiceText,selected===choice&&styles.choiceTextSelected]}>{choice}</Text>
            </Pressable>
          </Animated.View>
        ))}
      </View>
      {selected&&(
        <Animated.View entering={FadeInDown.springify().damping(17)} layout={Layout.springify()} style={styles.fund}>
          <View style={styles.fundHeader}><View style={styles.icon}><Ionicons name={selected==='Viaje'?'airplane':selected==='Casa'?'home':selected==='Asado'?'restaurant':'briefcase'} size={20} color={colors.yellow}/></View><Text style={styles.fundName}>{selected==='Viaje'?'Viaje Bariloche':`Fondo ${selected}`}</Text><Text style={styles.tag}>FONDO COMÚN</Text></View>
          {[['Tici','50'],['Joaco','50'],['Sofi','40']].map(([name,amount])=><View key={name} style={styles.person}><Text style={styles.personName}>{name}</Text><Text style={styles.personAmount}>{amount} USDC</Text></View>)}
          <View style={styles.total}><Text style={styles.totalLabel}>Total</Text><Text style={styles.totalAmount}>140 USDC</Text></View>
          <View style={styles.staking}><Ionicons name="leaf-outline" size={15} color={colors.success}/><Text style={styles.stakingText}>Puede participar en staking mientras esperan usarlo.</Text></View>
        </Animated.View>
      )}
      {selected&&<Text style={styles.reaction}>Juntan la plata y el fondo puede seguir trabajando.</Text>}
    </>
  );
}

const styles=StyleSheet.create({
  choices:{width:'100%',flexDirection:'row',flexWrap:'wrap',gap:spacing.xs,marginTop:spacing.md},
  choiceWrap:{width:'48%',flexGrow:1},
  choice:{height:42,alignItems:'center',justifyContent:'center',borderRadius:radius.pill,backgroundColor:colors.bgSoft,borderWidth:1,borderColor:colors.border},
  choiceSelected:{backgroundColor:colors.yellow,borderColor:colors.yellow},
  choiceText:{...typography.caption,color:colors.text},
  choiceTextSelected:{color:colors.black},
  pressed:{opacity:.7,transform:[{scale:.98}]},
  fund:{width:'100%',marginTop:spacing.sm,padding:spacing.sm,borderRadius:radius.lg,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},
  fundHeader:{flexDirection:'row',alignItems:'center',gap:spacing.xs,marginBottom:spacing.xs},
  icon:{width:34,height:34,borderRadius:radius.sm,alignItems:'center',justifyContent:'center',backgroundColor:colors.bgSoft},
  fundName:{...typography.bodyStrong,color:colors.text,flex:1},
  tag:{fontSize:8,lineHeight:11,color:colors.yellow,fontWeight:'900'},
  person:{minHeight:25,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  personName:{...typography.caption,color:colors.muted,fontWeight:'400'},
  personAmount:{...typography.caption,color:colors.text},
  total:{flexDirection:'row',justifyContent:'space-between',paddingTop:spacing.xs,marginTop:spacing.xxs,borderTopWidth:1,borderTopColor:colors.border},
  totalLabel:{...typography.caption,color:colors.muted},
  totalAmount:{...typography.bodyStrong,color:colors.text},
  staking:{flexDirection:'row',alignItems:'center',gap:5,marginTop:spacing.xs},
  stakingText:{fontSize:9,lineHeight:13,color:colors.success,flex:1},
  reaction:{...typography.caption,color:colors.yellow,textAlign:'center',marginTop:spacing.xs,fontWeight:'400'},
});
