import {PropsWithChildren} from 'react';
import {StyleSheet,Text,View} from 'react-native';
import Animated,{FadeInDown} from 'react-native-reanimated';
import {colors,radius,spacing,typography} from '@/constants/theme';

export function PatoSpeech({children,delay=80}:PropsWithChildren<{delay?:number}>){
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(300)} style={styles.bubble}>
      <View style={styles.tail}/>
      <Text style={styles.text}>{children}</Text>
    </Animated.View>
  );
}

const styles=StyleSheet.create({
  bubble:{width:'100%',paddingHorizontal:spacing.md,paddingVertical:spacing.sm,borderRadius:radius.lg,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},
  tail:{position:'absolute',top:-6,left:32,width:12,height:12,backgroundColor:colors.surface,borderLeftWidth:1,borderTopWidth:1,borderColor:colors.border,transform:[{rotate:'45deg'}]},
  text:{...typography.body,color:colors.text,textAlign:'center'},
});
