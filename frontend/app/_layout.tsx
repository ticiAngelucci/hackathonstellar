import 'react-native-gesture-handler';
import 'react-native-reanimated';
import {Stack} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {ReduceMotion, ReducedMotionConfig} from 'react-native-reanimated';
import {colors} from '@/constants/theme';

export default function Root() {
  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <ReducedMotionConfig mode={ReduceMotion.Never} />
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {backgroundColor: colors.bg},
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: {backgroundColor: colors.bg},
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" options={{headerShown: false}} />
        <Stack.Screen name="(tabs)" options={{headerShown: false}} />
        <Stack.Screen name="group/[id]" options={{title: 'Detalle de grupo'}} />
        <Stack.Screen name="fund" options={{title: 'Fondo común'}} />
        <Stack.Screen name="services" options={{title: 'Servicios automáticos'}} />
        <Stack.Screen name="permissions" options={{title: 'Permisos de pago'}} />
        <Stack.Screen name="payment/request" options={{title: 'Solicitud de pago'}} />
        <Stack.Screen name="payment/success" options={{headerShown: false}} />
      </Stack>
    </GestureHandlerRootView>
  );
}
