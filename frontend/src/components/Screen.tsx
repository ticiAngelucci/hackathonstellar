import {useMinimizeOnScroll} from 'expo-glass-tabs';
import {PropsWithChildren} from 'react';
import {StyleSheet, ViewStyle} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import {colors} from '@/constants/theme';

export function Screen({
  children,
  scroll = true,
  contentStyle,
}: PropsWithChildren<{scroll?: boolean; contentStyle?: ViewStyle}>) {
  const onScroll = useMinimizeOnScroll();

  if (!scroll) {
    return <SafeAreaView style={[s.safe, contentStyle]}>{children}</SafeAreaView>;
  }

  return (
    <SafeAreaView style={s.safe}>
      <Animated.ScrollView
        contentContainerStyle={[s.content, contentStyle]}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.bg},
  content: {padding: 20, paddingBottom: 140},
});
