import {Ionicons} from '@expo/vector-icons';
import {StyleSheet,Text,View} from 'react-native';
import Animated,{FadeInDown,ZoomIn} from 'react-native-reanimated';
import {PatoSpeech} from '@/features/onboarding/components/PatoSpeech';
import {colors,radius,spacing,typography} from '@/constants/theme';

export type PaymentDecision='paid'|'later'|null;

export function PaymentExampleStep({decision}:{decision:PaymentDecision}){
  return (
    <>
      <PatoSpeech>{decision==='paid'?'¡Perfecto! Vos siempre tenés la última palabra.':decision==='later'?'Está bien. No pago nada sin tu permiso.':'Por ejemplo…'}</PatoSpeech>
      {!decision?(
        <>
          <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.payment}>
            <View style={styles.icon}><Ionicons name="restaurant" size={22} color={colors.yellow}/></View>
            <View style={styles.copy}><Text style={styles.title}>Asado del viernes</Text><Text style={styles.part}>Tu parte: 10 USDC</Text></View>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(320).springify().damping(16)} style={styles.notification}>
            <View style={styles.bell}><Ionicons name="notifications" size={19} color={colors.yellow}/></View>
            <View style={styles.copy}><Text style={styles.app}>Pato Pay</Text><Text style={styles.question}>¿Querés pagarlo?</Text></View>
            <Text style={styles.now}>ahora</Text>
          </Animated.View>
        </>
      ):(
        <Animated.View entering={ZoomIn.springify().damping(12)} style={[styles.result,decision==='later'&&styles.resultLater]}>
          <View style={[styles.resultIcon,decision==='later'&&styles.resultIconLater]}><Ionicons name={decision==='paid'?'checkmark':'pause'} size={28} color={colors.bg}/></View>
          <Text style={styles.resultTitle}>{decision==='paid'?'Pago aprobado':'Pago pendiente'}</Text>
          <Text style={styles.resultText}>{decision==='paid'?'Pato celebra, pero esto sigue siendo un ejemplo del onboarding.':'Podés volver cuando quieras. Pato no movió nada.'}</Text>
        </Animated.View>
      )}
      {decision&&<Animated.Text entering={FadeInDown.delay(180).duration(280)} style={styles.account}>Listo. Ahora armemos tu cuenta.</Animated.Text>}
    </>
  );
}

const styles=StyleSheet.create({
  payment:{width:'100%',marginTop:spacing.md,padding:spacing.md,flexDirection:'row',alignItems:'center',gap:spacing.sm,borderRadius:radius.lg,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},
  icon:{width:46,height:46,borderRadius:radius.md,alignItems:'center',justifyContent:'center',backgroundColor:colors.bgSoft},
  copy:{flex:1},
  title:{...typography.bodyStrong,color:colors.text},
  part:{...typography.caption,color:colors.yellow,marginTop:2},
  notification:{width:'94%',marginTop:spacing.sm,padding:spacing.sm,flexDirection:'row',alignItems:'center',gap:spacing.sm,borderRadius:radius.md,backgroundColor:colors.surface2,borderWidth:1,borderColor:colors.blueBright},
  bell:{width:36,height:36,borderRadius:radius.sm,alignItems:'center',justifyContent:'center',backgroundColor:colors.bgSoft},
  app:{fontSize:10,lineHeight:13,color:colors.muted,fontWeight:'800'},
  question:{...typography.caption,color:colors.text,marginTop:1},
  now:{fontSize:8,lineHeight:11,color:colors.muted,alignSelf:'flex-start'},
  result:{width:'100%',marginTop:spacing.lg,padding:spacing.lg,alignItems:'center',borderRadius:radius.lg,backgroundColor:'rgba(30,215,164,.1)',borderWidth:1,borderColor:'rgba(30,215,164,.3)'},
  resultLater:{backgroundColor:'rgba(255,198,26,.08)',borderColor:'rgba(255,198,26,.28)'},
  resultIcon:{width:50,height:50,borderRadius:radius.pill,alignItems:'center',justifyContent:'center',backgroundColor:colors.success},
  resultIconLater:{backgroundColor:colors.yellow},
  resultTitle:{...typography.h3,color:colors.text,marginTop:spacing.sm},
  resultText:{...typography.caption,color:colors.muted,textAlign:'center',marginTop:spacing.xs,maxWidth:280,fontWeight:'400'},
  account:{...typography.bodyStrong,color:colors.yellow,textAlign:'center',marginTop:spacing.md},
});
