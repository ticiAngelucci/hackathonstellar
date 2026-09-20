import {PropsWithChildren} from 'react';
import {Pressable,StyleProp,StyleSheet,ViewStyle} from 'react-native';
import Animated,{FadeInDown,useAnimatedStyle,useSharedValue,withSpring} from 'react-native-reanimated';
import {colors,radius} from '@/constants/theme';

const AnimatedPressable=Animated.createAnimatedComponent(Pressable);

type AnimatedCardProps=PropsWithChildren<{
  onPress?:()=>void;
  style?:StyleProp<ViewStyle>;
  delay?:number;
}>;

export function AnimatedCard({children,onPress,style,delay=0}:AnimatedCardProps){
  const scale=useSharedValue(1);
  const animatedStyle=useAnimatedStyle(()=>({transform:[{scale:scale.value}]}));

  return (
    <AnimatedPressable
      entering={FadeInDown.delay(delay).duration(360)}
      onPress={onPress}
      onPressIn={()=>{scale.value=withSpring(.98,{damping:18,stiffness:260});}}
      onPressOut={()=>{scale.value=withSpring(1,{damping:18,stiffness:260});}}
      style={[styles.card,animatedStyle,style]}
    >
      {children}
    </AnimatedPressable>
  );
}

const styles=StyleSheet.create({
  card:{
    backgroundColor:colors.surface,
    borderRadius:radius.lg,
    borderWidth:1,
    borderColor:colors.border,
  },
});
