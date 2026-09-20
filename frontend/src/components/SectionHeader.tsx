import {Pressable,StyleSheet,Text,View} from 'react-native';
import {colors,spacing,typography} from '@/constants/theme';

export function SectionHeader({title,action,onPress,compact=false}:{title:string;action?:string;onPress?:()=>void;compact?:boolean}){
  return (
    <View style={styles.row}>
      <Text style={[styles.title,compact&&styles.compactTitle]}>{title}</Text>
      {action&&<Pressable onPress={onPress}><Text style={styles.action}>{action}</Text></Pressable>}
    </View>
  );
}

const styles=StyleSheet.create({
  row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:spacing.sm},
  title:{...typography.h2,color:colors.text},
  compactTitle:{...typography.h3,fontSize:16},
  action:{...typography.small,color:colors.yellow,fontWeight:'800'},
});
