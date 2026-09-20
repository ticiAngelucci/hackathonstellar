import {router} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {StyleSheet,Text,View} from 'react-native';
import {Screen} from '@/components/Screen';
import {PatoAvatar} from '@/components/PatoAvatar';
import {AnimatedCard} from '@/components/AnimatedCard';
import {colors,radius,spacing,typography} from '@/constants/theme';

const items=[
  ['Reglas del agente','options','/permissions'],
  ['Métodos de pago','card',null],
  ['Notificaciones','notifications',null],
  ['Ayuda','help-circle',null],
  ['Configuración','settings',null],
] as const;

export default function Profile(){
  return (
    <Screen>
      <View style={styles.hero}>
        <PatoAvatar size={96}/>
        <Text style={styles.name}>Negro</Text>
        <View style={styles.statusRow}><View style={styles.statusDot}/><Text style={styles.status}>Tu agente está activo</Text></View>
      </View>
      <View style={styles.list}>
        {items.map(([label,icon,route],index)=>(
          <AnimatedCard key={label} delay={index*45} style={styles.item} onPress={()=>route&&router.push(route)}>
            <View style={styles.icon}><Ionicons name={icon} size={19} color={colors.yellow}/></View>
            <Text style={styles.itemText}>{label}</Text>
            <Ionicons name="chevron-forward" size={17} color={colors.muted}/>
          </AnimatedCard>
        ))}
      </View>
    </Screen>
  );
}

const styles=StyleSheet.create({
  hero:{alignItems:'center',marginBottom:spacing.xl},
  name:{...typography.h2,color:colors.text,marginTop:spacing.sm},
  statusRow:{flexDirection:'row',alignItems:'center',gap:6,marginTop:spacing.xxs},
  statusDot:{width:7,height:7,borderRadius:4,backgroundColor:colors.success},
  status:{...typography.small,color:colors.success},
  list:{gap:spacing.xs},
  item:{minHeight:58,paddingHorizontal:spacing.sm,paddingVertical:spacing.xs,flexDirection:'row',alignItems:'center',gap:spacing.sm,borderRadius:radius.md},
  icon:{width:38,height:38,borderRadius:radius.sm,backgroundColor:colors.bgSoft,alignItems:'center',justifyContent:'center'},
  itemText:{...typography.bodyStrong,color:colors.text,flex:1},
});
