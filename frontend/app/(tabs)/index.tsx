import {useCallback,useEffect,useState} from 'react';
import {router} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {ActivityIndicator,Pressable,StyleSheet,Text,View} from 'react-native';
import Animated,{FadeInDown} from 'react-native-reanimated';
import {Screen} from '@/components/Screen';
import {PatoAvatar} from '@/components/PatoAvatar';
import {PatoAgent} from '@/components/PatoAgent';
import {BalanceCard} from '@/components/BalanceCard';
import {ActionButton} from '@/components/ActionButton';
import {AnimatedCard} from '@/components/AnimatedCard';
import {SectionHeader} from '@/components/SectionHeader';
import {transactionService} from '@/services/appDataService';
import {walletService} from '@/services/wallet';
import {Transaction} from '@/types';
import {colors,radius,spacing,typography} from '@/constants/theme';

export default function Home(){
  const [balance,setBalance]=useState(0);
  const [assetCode,setAssetCode]=useState('XLM');
  const [walletAddress,setWalletAddress]=useState<string|null>(null);
  const [walletFunded,setWalletFunded]=useState<boolean|null>(null);
  const [transactions,setTransactions]=useState<Transaction[]>([]);
  const [loading,setLoading]=useState(true);
  const [dataError,setDataError]=useState<string|null>(null);
  const displayName=process.env.EXPO_PUBLIC_PATOPAY_DISPLAY_NAME??'Negro';

  const refresh=useCallback(async()=>{
    setLoading(true);
    const account=await walletService.getAccount().catch(()=>null);
    setWalletAddress(account?.walletAddress??null);

    const [balanceResult,transactionsResult]=await Promise.allSettled([
      account?walletService.getBalance(account.walletAddress):Promise.resolve(null),
      transactionService.list(3),
    ]);
    const errors:string[]=[];
    if(balanceResult.status==='fulfilled'&&balanceResult.value){
      setBalance(balanceResult.value.amount);
      setAssetCode(balanceResult.value.assetCode);
      setWalletFunded(balanceResult.value.funded);
    }else if(balanceResult.status==='rejected'){
      errors.push(balanceResult.reason instanceof Error?balanceResult.reason.message:'No pudimos consultar Stellar.');
    }
    if(transactionsResult.status==='fulfilled')setTransactions(transactionsResult.value);
    else errors.push(transactionsResult.reason instanceof Error?transactionsResult.reason.message:'No pudimos cargar la actividad.');
    setDataError(errors.length?errors.join(' '):null);
    setLoading(false);
  },[]);

  useEffect(()=>{void refresh();},[refresh]);

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.header}>
        <PatoAvatar size={46}/>
        <View style={styles.headerCopy}>
          <Text style={styles.hello}>Hola, {displayName} 👋</Text>
          <Text style={styles.sub}>Todo en orden por acá.</Text>
        </View>
        <Pressable accessibilityLabel="Notificaciones" style={({pressed})=>[styles.bell,pressed&&styles.pressed]}>
          <Ionicons name="notifications-outline" size={21} color={colors.text}/>
        </Pressable>
      </View>

      <BalanceCard balance={balance} assetCode={assetCode} onAdd={()=>router.push('/fund')}/>
      {walletAddress&&walletFunded===false&&<Text style={styles.unfunded}>Tu wallet está creada, pero todavía no tiene fondos.</Text>}

      <View style={styles.actions}>
        <ActionButton compact disabled={!walletAddress} icon="arrow-up" label="Enviar" onPress={()=>router.push('/payment/send')}/>
        <ActionButton compact icon="arrow-down" label="Recibir" onPress={()=>router.push('/fund')}/>
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

      <SectionHeader compact title="Actividad reciente" action="Ver todo ›" onPress={()=>router.push('/(tabs)/activity')}/>
      <AnimatedCard delay={180} style={styles.activityCard}>
        {loading&&<View style={styles.activityState}><ActivityIndicator color={colors.yellow}/><Text style={styles.stateText}>Actualizando…</Text></View>}
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
            <Text style={styles.stateText}>Todavía no hay movimientos reales.</Text>
          </Animated.View>
        )}
        {!loading&&!dataError&&transactions.map((tx,index)=>(
          <View key={tx.id} style={[styles.transaction,index===transactions.length-1&&styles.lastTransaction]}>
            <View style={styles.txIcon}>
              <Ionicons name={tx.icon as keyof typeof Ionicons.glyphMap} size={18} color={index===1?colors.success:colors.blueBright}/>
            </View>
            <View style={styles.txCopy}>
              <Text numberOfLines={1} style={styles.txTitle}>{tx.title}</Text>
              <Text style={styles.txSub}>{tx.subtitle}</Text>
            </View>
            <Text style={[styles.amount,tx.amount>0&&styles.income]}>{tx.amount>0?'+':''}{tx.amount.toFixed(2)} USDC</Text>
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
