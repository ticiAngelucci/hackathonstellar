import {router} from 'expo-router';
import {Pressable} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {DEMO_MODE} from '@/demo/demo.config';
import {colors} from '@/constants/theme';
export function DemoBadge(){
  if(!DEMO_MODE&&!__DEV__)return null;
  return <Pressable accessibilityRole="button" accessibilityLabel="Abrir opciones" onPress={()=>router.push('/demo')} style={{alignSelf:'flex-end',paddingHorizontal:12,paddingVertical:5}}><Ionicons name="ellipsis-horizontal" size={18} color={colors.muted}/></Pressable>;
}
