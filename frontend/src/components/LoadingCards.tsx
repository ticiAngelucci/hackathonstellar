import {View} from 'react-native';
import Animated,{FadeIn} from 'react-native-reanimated';
import {colors,radius,spacing} from '@/constants/theme';
export function LoadingCards(){return <View accessibilityLabel="Cargando" style={{gap:spacing.sm,marginVertical:spacing.md}}>{[0,1,2].map(index=><Animated.View key={index} entering={FadeIn.delay(index*70)} style={{height:64,borderRadius:radius.md,backgroundColor:colors.surface,padding:16}}><View style={{height:10,width:'55%',backgroundColor:colors.border,borderRadius:5}}/><View style={{height:8,width:'32%',backgroundColor:colors.border,borderRadius:4,marginTop:10}}/></Animated.View>)}</View>;}
