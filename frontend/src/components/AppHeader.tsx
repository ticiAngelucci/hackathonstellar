import {router} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {colors,radius,spacing,typography} from '@/constants/theme';

export function AppHeader({title,onBack}:{title:string;onBack?:()=>void}){
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="Volver"
        accessibilityRole="button"
        onPress={onBack??(()=>router.back())}
        style={({pressed})=>[styles.back,pressed&&styles.pressed]}
      >
        <Ionicons name="chevron-back" size={22} color={colors.text}/>
      </Pressable>
      <Text numberOfLines={1} style={styles.title}>{title}</Text>
      <View style={styles.spacer}/>
    </View>
  );
}

const styles=StyleSheet.create({
  header:{height:52,flexDirection:'row',alignItems:'center',marginBottom:spacing.md},
  back:{width:42,height:42,borderRadius:radius.pill,alignItems:'center',justifyContent:'center',backgroundColor:colors.bgSoft,borderWidth:1,borderColor:colors.border},
  pressed:{opacity:.7},
  title:{...typography.h3,color:colors.text,flex:1,textAlign:'center',paddingHorizontal:spacing.sm},
  spacer:{width:42},
});
