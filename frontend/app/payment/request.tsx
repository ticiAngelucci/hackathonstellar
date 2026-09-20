import {router} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {Image,StyleSheet,Text,View} from 'react-native';
import Animated,{FadeInDown} from 'react-native-reanimated';
import {Screen} from '@/components/Screen';
import {AppHeader} from '@/components/AppHeader';
import {PrimaryButton} from '@/components/PrimaryButton';
import {colors,radius,spacing,typography} from '@/constants/theme';

export default function Request(){
  return (
    <Screen>
      <AppHeader title="Solicitud de pago"/>
      <Animated.View entering={FadeInDown.duration(320)} style={styles.emptyCard}>
        <View style={styles.icon}><Ionicons name="receipt-outline" size={26} color={colors.yellow}/></View>
        <Text style={styles.title}>No hay solicitudes pendientes</Text>
        <Text style={styles.copy}>Cuando llegue una solicitud real desde Supabase, vas a poder revisarla y aprobarla acá.</Text>
        <Image
          source={require('../../assets/pato/pato-approval.png')}
          style={styles.pato}
          resizeMode="contain"
        />
      </Animated.View>
      <View style={styles.buttons}>
        <PrimaryButton title="Volver" onPress={()=>router.back()}/>
      </View>
    </Screen>
  );
}

const styles=StyleSheet.create({
  emptyCard:{alignItems:'center',padding:spacing.lg,borderRadius:radius.lg,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},
  icon:{width:54,height:54,borderRadius:radius.md,alignItems:'center',justifyContent:'center',backgroundColor:colors.bgSoft},
  title:{...typography.h2,color:colors.text,textAlign:'center',marginTop:spacing.md},
  copy:{...typography.small,color:colors.muted,textAlign:'center',marginTop:spacing.xs,maxWidth:300},
  pato:{width:158,height:158,alignSelf:'center',marginTop:spacing.sm,marginBottom:-spacing.md},
  buttons:{gap:spacing.sm},
});
