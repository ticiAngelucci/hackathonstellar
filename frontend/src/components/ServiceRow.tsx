import {Ionicons} from '@expo/vector-icons';
import {StyleSheet,Switch,Text,View} from 'react-native';
import {ServiceSubscription} from '@/types';
import {colors,radius,spacing,typography} from '@/constants/theme';

export function ServiceRow({service,onToggle,last=false,disabled=false}:{service:ServiceSubscription;onToggle:()=>void;last?:boolean;disabled?:boolean}){
  return (
    <View style={[styles.row,last&&styles.last,disabled&&styles.disabled]}>
      <View style={styles.icon}>
        <Ionicons name={service.icon as keyof typeof Ionicons.glyphMap} size={21} color={colors.yellow}/>
      </View>
      <View style={styles.copy}>
        <Text style={styles.name}>{service.name}</Text>
        <Text style={styles.price}>{service.amount===undefined?'Preferencia de pago':`${service.amount.toFixed(2)} USDC/mes`}</Text>
      </View>
      <Switch
        accessibilityLabel={`${service.enabled?'Desactivar':'Activar'} ${service.name}`}
        disabled={disabled}
        value={service.enabled}
        onValueChange={onToggle}
        trackColor={{false:colors.border,true:colors.yellow}}
        thumbColor={service.enabled?colors.black:colors.muted}
      />
    </View>
  );
}

const styles=StyleSheet.create({
  row:{flexDirection:'row',alignItems:'center',padding:spacing.md,borderBottomWidth:1,borderBottomColor:colors.border,gap:spacing.sm},
  last:{borderBottomWidth:0},
  disabled:{opacity:.55},
  icon:{width:44,height:44,borderRadius:radius.md,backgroundColor:colors.bgSoft,alignItems:'center',justifyContent:'center'},
  copy:{flex:1},
  name:{...typography.bodyStrong,color:colors.text,fontWeight:'800'},
  price:{...typography.small,color:colors.muted,marginTop:2},
});
