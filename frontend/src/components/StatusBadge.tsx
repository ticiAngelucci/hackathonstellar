import {StyleSheet,Text,View} from 'react-native';
import {TransactionStatus} from '@/types';
import {colors,radius,spacing,typography} from '@/constants/theme';

const statusConfig:Record<TransactionStatus,{label:string;color:string}>={
  pending:{label:'Pendiente',color:colors.yellow},
  paid:{label:'Pagado',color:colors.success},
  auto:{label:'Auto',color:colors.success},
  blocked:{label:'Bloqueado',color:colors.danger},
  received:{label:'Recibido',color:colors.blueBright},
};

export function StatusBadge({status}:{status:TransactionStatus}){
  const config=statusConfig[status];
  return (
    <View style={styles.badge}>
      <View style={[styles.dot,{backgroundColor:config.color}]}/>
      <Text style={[styles.text,{color:config.color}]}>{config.label}</Text>
    </View>
  );
}

const styles=StyleSheet.create({
  badge:{flexDirection:'row',alignItems:'center',gap:spacing.xxs,paddingHorizontal:spacing.xs,paddingVertical:3,borderRadius:radius.pill,backgroundColor:colors.bgSoft},
  dot:{width:5,height:5,borderRadius:3},
  text:{...typography.caption,fontSize:10,lineHeight:14},
});
