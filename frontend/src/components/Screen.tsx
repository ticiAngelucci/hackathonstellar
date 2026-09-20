import {useMinimizeOnScroll} from 'expo-glass-tabs';
import {PropsWithChildren} from 'react';
import {StyleProp,StyleSheet,View,ViewStyle} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import {colors,spacing} from '@/constants/theme';

type ScreenProps=PropsWithChildren<{
  scroll?:boolean;
  contentStyle?:StyleProp<ViewStyle>;
}>;

export function Screen({children,scroll=true,contentStyle}:ScreenProps){
  const onScroll=useMinimizeOnScroll();

  if(!scroll){
    return (
      <SafeAreaView style={styles.safe}>
        <View style={[styles.content,styles.fixed,contentStyle]}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.ScrollView
        contentContainerStyle={[styles.content,contentStyle]}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.bg},
  content:{paddingHorizontal:spacing.lg,paddingTop:spacing.sm,paddingBottom:140},
  fixed:{flex:1,paddingBottom:spacing.xxl},
});
