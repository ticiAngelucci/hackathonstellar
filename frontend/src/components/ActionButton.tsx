import {Ionicons} from '@expo/vector-icons';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import Animated,{useAnimatedStyle,useSharedValue,withSpring} from 'react-native-reanimated';
import {colors,radius,spacing,typography} from '@/constants/theme';

const AnimatedPressable=Animated.createAnimatedComponent(Pressable);

export function ActionButton({icon,label,onPress,compact=false,disabled=false}:{icon:keyof typeof Ionicons.glyphMap;label:string;onPress:()=>void;compact?:boolean;disabled?:boolean}){
  const scale=useSharedValue(1);
  const animatedStyle=useAnimatedStyle(()=>({transform:[{scale:scale.value}]}));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{disabled}}
      disabled={disabled}
      onPress={onPress}
      onPressIn={()=>{scale.value=withSpring(.96,{damping:18,stiffness:260});}}
      onPressOut={()=>{scale.value=withSpring(1,{damping:18,stiffness:260});}}
      style={[styles.wrap,disabled&&styles.disabled,animatedStyle]}
    >
      <View style={[styles.icon,compact&&styles.compactIcon]}><Ionicons name={icon} size={compact?19:21} color={colors.text}/></View>
      <Text numberOfLines={1} style={styles.label}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles=StyleSheet.create({
  wrap:{alignItems:'center',gap:spacing.xs,flex:1},
  disabled:{opacity:.42},
  icon:{width:54,height:54,borderRadius:radius.md,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:colors.border},
  compactIcon:{width:48,height:48,borderRadius:radius.pill},
  label:{...typography.caption,color:colors.text},
});
