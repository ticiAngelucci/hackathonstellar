import {router} from 'expo-router';
import {LinearGradient} from 'expo-linear-gradient';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {colors, radius} from '@/constants/theme';

export function BalanceCard({balance}: {balance: number}) {
  return (
    <LinearGradient colors={['#0B2A4D', '#0D3D75']} style={s.card}>
      <Text style={s.label}>Tu saldo</Text>
      <View style={s.row}>
        <Text style={s.amount}>{balance.toFixed(2)}</Text>
        <Text style={s.asset}>USDC</Text>
      </View>
      <Pressable accessibilityRole="link" hitSlop={8} onPress={() => router.push('/permissions')}>
        <Text style={s.caption}>
          Tu agente puede usar este saldo según <Text style={s.link}>tus reglas</Text>.
        </Text>
      </Pressable>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  card: {borderRadius: radius.lg, padding: 20, borderWidth: 1, borderColor: colors.border},
  label: {color: colors.muted},
  row: {flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6},
  amount: {color: colors.text, fontSize: 38, fontWeight: '900'},
  asset: {color: colors.text, fontSize: 18, fontWeight: '700'},
  caption: {marginTop: 10, color: colors.muted},
  link: {color: colors.yellow, fontWeight: '800', textDecorationLine: 'underline'},
});
