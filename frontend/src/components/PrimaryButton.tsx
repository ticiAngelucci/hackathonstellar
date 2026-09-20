import {Ionicons} from '@expo/vector-icons';
import {Pressable,StyleProp,StyleSheet,Text,ViewStyle} from 'react-native';
import Animated,{useAnimatedStyle,useSharedValue,withSpring} from 'react-native-reanimated';
import {colors,radius,spacing,typography} from '@/constants/theme';

type PrimaryButtonProps={
  title:string;
  onPress:()=>void;
  icon?:keyof typeof Ionicons.glyphMap;
  style?:StyleProp<ViewStyle>;
  disabled?:boolean;
  variant?:'primary'|'secondary'|'danger';
};

const AnimatedPressable=Animated.createAnimatedComponent(Pressable);

export function PrimaryButton({title,onPress,icon,style,disabled=false,variant='primary'}:PrimaryButtonProps){
  const outlined=variant!=='primary';
  const scale=useSharedValue(1);
  const animatedStyle=useAnimatedStyle(()=>({transform:[{scale:scale.value}]}));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{disabled}}
      disabled={disabled}
      onPress={onPress}
      onPressIn={()=>{scale.value=withSpring(.98,{damping:18,stiffness:260});}}
      onPressOut={()=>{scale.value=withSpring(1,{damping:18,stiffness:260});}}
      style={[
        styles.base,
        styles[variant],
        style,
        disabled&&styles.disabled,
        animatedStyle,
      ]}
    >
      {icon&&<Ionicons name={icon} size={19} color={outlined?colors.text:colors.black}/>}
      <Text style={[styles.text,outlined&&styles.light]}>{title}</Text>
    </AnimatedPressable>
  );
}

const styles=StyleSheet.create({
  base:{
    width:'100%',
    minHeight:54,
    borderRadius:radius.pill,
    alignItems:'center',
    justifyContent:'center',
    flexDirection:'row',
    gap:spacing.xs,
    paddingHorizontal:spacing.lg,
  },
  primary:{backgroundColor:colors.yellow},
  secondary:{backgroundColor:colors.transparent,borderWidth:1,borderColor:colors.border},
  danger:{backgroundColor:colors.transparent,borderWidth:1,borderColor:colors.danger},
  disabled:{opacity:.5},
  text:{...typography.bodyStrong,color:colors.black,fontWeight:'900'},
  light:{color:colors.text},
});
