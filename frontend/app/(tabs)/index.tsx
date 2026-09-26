import {useTransactions} from '@/hooks/useTransactions';
import {useWalletBalance} from '@/hooks/useWalletBalance';
import {LoadingCards} from '@/components/LoadingCards';
import {userMessage} from '@/lib/errors';
import {usePaymentRequests} from '@/hooks/usePaymentRequests';
import {useProfile} from '@/hooks/useProfile';
import {useOnboarding} from '@/features/onboarding/store/OnboardingProvider';
import {DEMO_MODE} from '@/demo/demo.config';
import {useCallback} from 'react';
import {router,useFocusEffect} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import Animated,{FadeInDown} from 'react-native-reanimated';
import {Screen} from '@/components/Screen';
import {PatoAvatar} from '@/components/PatoAvatar';
import {PatoAgent} from '@/components/PatoAgent';
import {BalanceCard} from '@/components/BalanceCard';
import {ActionButton} from '@/components/ActionButton';
import {AnimatedCard} from '@/components/AnimatedCard';
import {SectionHeader} from '@/components/SectionHeader';
import {colors,radius,spacing,typography} from '@/constants/theme';

export default function Home(){
  const wallet=useWalletBalance();const activity=useTransactions();
  const balance=wallet.isError||wallet.isLoading?null:wallet.data?.balance?.amount??null;
  const assetCode=wallet.data?.balance?.assetCode??'';
  const walletAddress=wallet.data?.address;
  const walletFunded=wallet.data?.balance?.funded;
  const transactions=(activity.data??[]).slice(0,3);const loading=activity.isLoading;
  const dataError=activity.error?userMessage(activity.error,'No pudimos cargar tu actividad.'):null;
  const {profile}=useOnboarding();
  const remoteProfile=useProfile();
  const requests=usePaymentRequests();
  const displayName=(DEMO_MODE?profile.displayName:remoteProfile.data?.displayName??'').trim();

  const {refetch:refreshWallet}=wallet;const {refetch:refreshActivity}=activity;
  const refresh=useCallback(async()=>{await Promise.all([refreshWallet(),refreshActivity()]);},[refreshWallet,refreshActivity]);

  useFocusEffect(useCallback(()=>{void refresh();},[refresh]));

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.header}>
        <PatoAvatar size={46}/>
        <View style={styles.headerCopy}>
          <Text style={styles.hello}>Hola{displayName?`, ${displayName}`:''} 👋</Text>
          <Text style={styles.sub}>Todo en orden por acá.</Text>
        </View>
        <Pressable onPress={()=>router.push('/payment/request')} accessibilityLabel="Notificaciones" style={({pressed})=>[styles.bell,pressed&&styles.pressed]}>
          <Ionicons name="notifications-outline" size={21} color={colors.text}/>
        </Pressable>
      </View>

      <BalanceCard balance={balance} assetCode={assetCode} onAdd={()=>router.push('/fund')}/>
      {wallet.data?.notice&&<Text style={styles.stateText}>{wallet.data.notice}</Text>}
      {wallet.error&&<Text style={styles.stateText}>{userMessage(wallet.error,'No pudimos consultar tu saldo.')}</Text>}
      {walletAddress&&walletFunded===false&&<Text style={styles.unfunded}>Tu wallet está creada, pero todavía no tiene fondos.</Text>}

      <View style={styles.actions}>
        <ActionButton compact disabled={!wallet.data?.canSign} icon="arrow-up" label="Enviar" onPress={()=>router.push('/payment/send')}/>
        <ActionButton compact icon={DEMO_MODE?"people":"arrow-down"} label={DEMO_MODE?"Grupos":"Recibir"} onPress={()=>router.push(DEMO_MODE?'/(tabs)/groups':'/fund')}/>
        <ActionButton compact icon="people" label="Servicios" onPress={()=>router.push('/services')}/>
        <ActionButton compact icon="ellipsis-horizontal" label="Más" onPress={()=>router.push('/permissions')}/>
      </View>

      <AnimatedCard delay={120} style={styles.agent} onPress={()=>router.push('/(tabs)/pato')}>
        <PatoAgent size={108} style={styles.agentPato}/>
        <View style={styles.agentCopy}>
          <Text style={styles.agentTitle}>Pato trabaja{`\n`}para vos</Text>
          <Text style={styles.agentText}>Pagos, ahorros y más.{`\n`}Sin complicaciones.</Text>
        </View>
        <View style={styles.agentArrow}>
          <Ionicons name="arrow-forward" size={18} color={colors.yellow}/>
        </View>
      </AnimatedCard>

      {!DEMO_MODE&&<AnimatedCard onPress={()=>router.push('/payment/request')} style={{padding:spacing.md,marginBottom:spacing.md}}><Text style={{color:colors.text}}>Solicitudes de pago</Text><Text style={{color:colors.muted}}>{requests.error?'No pudimos actualizar tus solicitudes. Tocá para reintentar.':`${requests.data?.filter(r=>r.status==='pending').length??0} pendientes`}</Text></AnimatedCard>}
      <SectionHeader compact title="Actividad reciente" action="Ver todo ›" onPress={()=>router.push('/(tabs)/activity')}/>
      <AnimatedCard delay={180} style={styles.activityCard}>
        {loading&&<LoadingCards/>}
        {!loading&&dataError&&(
          <Animated.View entering={FadeInDown.duration(240)} style={styles.activityState}>
            <Ionicons name="cloud-offline-outline" size={20} color={colors.danger}/>
            <Text style={styles.stateText}>{dataError}</Text>
            <Pressable onPress={()=>void refresh()}><Text style={styles.retry}>Reintentar</Text></Pressable>
          </Animated.View>
        )}
        {!loading&&!dataError&&transactions.length===0&&(
          <Animated.View entering={FadeInDown.duration(260)} style={styles.activityState}>
            <Ionicons name="receipt-outline" size={21} color={colors.muted}/>
            <Text style={styles.stateText}>Todavía no hay movimientos.</Text>
          </Animated.View>
        )}
        {transactions.map((tx,index)=>(
          <View key={tx.id} style={[styles.transaction,index===transactions.length-1&&styles.lastTransaction]}>
            <View style={styles.txIcon}>
              <Ionicons name={tx.icon as keyof typeof Ionicons.glyphMap} size={18} color={index===1?colors.success:colors.blueBright}/>
            </View>
            <View style={styles.txCopy}>
              <Text numberOfLines={1} style={styles.txTitle}>{tx.title}</Text>
              <Text style={styles.txSub}>{tx.subtitle}</Text>
            </View>
            <Text style={[styles.amount,tx.amount>0&&styles.income]}>{tx.displayAmount??`${tx.amount>0?'+':''}${tx.amount.toFixed(2)}`} {tx.assetCode??'USDC'}</Text>
          </View>
        ))}
      </AnimatedCard>
    </Screen>
  );
}

const styles=StyleSheet.create({
  screen:{paddingBottom:spacing.xl},
  header:{flexDirection:'row',alignItems:'center',gap:spacing.sm,marginBottom:spacing.md},
  headerCopy:{flex:1},
  hello:{...typography.h3,color:colors.text},
  sub:{...typography.caption,color:colors.muted,marginTop:1,fontWeight:'400'},
  bell:{width:38,height:38,borderRadius:radius.pill,alignItems:'center',justifyContent:'center'},
  pressed:{opacity:.65},
  actions:{flexDirection:'row',gap:spacing.xs,marginVertical:spacing.md},
  agent:{height:116,paddingRight:spacing.sm,flexDirection:'row',alignItems:'center',gap:spacing.xs,marginBottom:spacing.lg,overflow:'hidden',borderColor:colors.blue},
  agentPato:{marginLeft:-spacing.xs,marginBottom:-spacing.xs},
  agentCopy:{flex:1,marginLeft:-spacing.sm},
  agentTitle:{...typography.bodyStrong,color:colors.yellow,fontWeight:'900'},
  agentText:{...typography.caption,color:colors.muted,marginTop:spacing.xxs,fontWeight:'400'},
  agentArrow:{width:34,height:34,borderRadius:radius.pill,alignItems:'center',justifyContent:'center',backgroundColor:colors.blue},
  activityCard:{paddingHorizontal:spacing.sm,overflow:'hidden',borderRadius:radius.md},
  activityState:{minHeight:96,alignItems:'center',justifyContent:'center',gap:spacing.xs,padding:spacing.sm},
  stateText:{...typography.caption,color:colors.muted,textAlign:'center',fontWeight:'400'},
  retry:{...typography.caption,color:colors.yellow},
  transaction:{minHeight:62,flexDirection:'row',alignItems:'center',gap:spacing.sm,borderBottomWidth:1,borderBottomColor:colors.border},
  lastTransaction:{borderBottomWidth:0},
  txIcon:{width:36,height:36,borderRadius:radius.pill,backgroundColor:colors.bgSoft,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:colors.border},
  txCopy:{flex:1},
  txTitle:{...typography.bodyStrong,color:colors.text,fontSize:13},
  txSub:{...typography.caption,color:colors.muted,marginTop:1,fontSize:10},
  amount:{...typography.caption,color:colors.text,textAlign:'right',fontSize:11},
  income:{color:colors.success},
  unfunded:{...typography.caption,color:colors.yellow,textAlign:'center',marginTop:spacing.xs,fontWeight:'500'},
});
