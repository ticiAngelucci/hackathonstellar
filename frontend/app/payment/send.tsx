import {useEffect,useState} from 'react';
import {router} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {ActivityIndicator,Pressable,StyleSheet,Text,TextInput,View} from 'react-native';
import Animated,{FadeInDown} from 'react-native-reanimated';
import {Screen} from '@/components/Screen';
import {PrimaryButton} from '@/components/PrimaryButton';
import {walletMode,walletService,type WalletAccount} from '@/services/wallet';
import {colors,radius,spacing,typography} from '@/constants/theme';

type PaymentStage='idle'|'preparing'|'signing'|'submitting';

export default function SendPayment(){
  const [account,setAccount]=useState<WalletAccount|null>(null);
  const [destination,setDestination]=useState('');
  const [amount,setAmount]=useState('10');
  const [assetCode,setAssetCode]=useState('XLM');
  const [stage,setStage]=useState<PaymentStage>('idle');
  const [error,setError]=useState<string|null>(null);

  useEffect(()=>{
    walletService.getAccount().then(async next=>{
      setAccount(next);
      if(next){
        const balance=await walletService.getBalance(next.walletAddress);
        setAssetCode(balance.assetCode);
      }
    }).catch(nextError=>setError(nextError instanceof Error?nextError.message:'No pudimos cargar la wallet.'));
  },[]);

  const submit=async()=>{
    if(stage!=='idle')return;
    setError(null);
    try{
      setStage('preparing');
      const prepared=await walletService.preparePayment({destination:destination.trim(),amount});
      setStage('signing');
      const signed=await walletService.signPayment(prepared);
      setStage('submitting');
      const submitted=await walletService.submitPayment(signed);
      router.replace({
        pathname:'/payment/success',
        params:{
          txHash:submitted.txHash,
          amount:submitted.amount,
          asset:submitted.assetCode,
          recipient:submitted.destination,
        },
      });
    }catch(nextError){
      setError(nextError instanceof Error?nextError.message:'No pudimos enviar el pago.');
      setStage('idle');
    }
  };

  const busy=stage!=='idle';
  const stageLabel=stage==='preparing'?'Preparando en Stellar…':stage==='signing'?'Esperando tu passkey…':stage==='submitting'?'Enviando a Testnet…':'';

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Volver" onPress={()=>router.back()} style={({pressed})=>[styles.headerButton,pressed&&styles.pressed]}>
          <Ionicons name="arrow-back" size={21} color={colors.text}/>
        </Pressable>
        <Text style={styles.headerTitle}>Enviar pago</Text>
        <View style={styles.headerButton}/>
      </View>

      <Animated.View entering={FadeInDown.duration(280)} style={styles.card}>
        <View style={styles.icon}><Ionicons name="paper-plane-outline" size={26} color={colors.yellow}/></View>
        <Text style={styles.title}>Pago real en Testnet</Text>
        <Text style={styles.copy}>La passkey autoriza la operación. El bloqueo de la app no firma transacciones.</Text>
        <Text style={styles.label}>DESTINO STELLAR</Text>
        <TextInput autoCapitalize="characters" autoCorrect={false} editable={!busy} onChangeText={setDestination} placeholder="G… o C…" placeholderTextColor={colors.muted} style={styles.input} value={destination}/>
        <Text style={styles.label}>MONTO</Text>
        <View style={styles.amountRow}>
          <TextInput editable={!busy} keyboardType="decimal-pad" onChangeText={setAmount} style={[styles.input,styles.amountInput]} value={amount}/>
          <Text style={styles.asset}>{assetCode}</Text>
        </View>
        {account&&<Text numberOfLines={1} style={styles.from}>Desde {account.walletAddress.slice(0,10)}…{account.walletAddress.slice(-8)}</Text>}
        <Text style={styles.mode}>{walletMode==='stellar'?'STELLAR TESTNET':'MODO MOCK · NO ENVÍA BLOCKCHAIN'}</Text>
      </Animated.View>

      {busy&&<View style={styles.status}><ActivityIndicator color={colors.yellow}/><Text style={styles.statusText}>{stageLabel}</Text></View>}
      {error&&<Text style={styles.error}>{error}</Text>}
      <PrimaryButton disabled={busy||!account||!destination.trim()||!amount.trim()} title={busy?'Procesando…':'Aprobar y pagar'} onPress={()=>void submit()}/>
    </Screen>
  );
}

const styles=StyleSheet.create({
  screen:{paddingHorizontal:spacing.md,paddingTop:spacing.xxs,gap:spacing.md},
  header:{height:42,flexDirection:'row',alignItems:'center'},
  headerButton:{width:38,height:38,alignItems:'center',justifyContent:'center'},
  headerTitle:{...typography.bodyStrong,color:colors.text,flex:1,textAlign:'center',fontWeight:'800'},
  pressed:{opacity:.7},
  card:{padding:spacing.lg,borderRadius:radius.lg,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},
  icon:{width:52,height:52,borderRadius:radius.md,alignItems:'center',justifyContent:'center',backgroundColor:colors.bgSoft,alignSelf:'center'},
  title:{...typography.h2,color:colors.text,textAlign:'center',marginTop:spacing.sm},
  copy:{...typography.caption,color:colors.muted,textAlign:'center',marginTop:spacing.xs,fontWeight:'400'},
  label:{fontSize:9,lineHeight:12,color:colors.muted,fontWeight:'900',letterSpacing:1,marginTop:spacing.md,marginBottom:spacing.xxs},
  input:{minHeight:52,borderRadius:radius.md,backgroundColor:colors.bgSoft,borderWidth:1,borderColor:colors.border,color:colors.text,paddingHorizontal:spacing.sm,...typography.body},
  amountRow:{flexDirection:'row',alignItems:'center',gap:spacing.sm},
  amountInput:{flex:1,fontSize:24,fontWeight:'800'},
  asset:{...typography.bodyStrong,color:colors.yellow,minWidth:50},
  from:{...typography.caption,color:colors.blueBright,textAlign:'center',marginTop:spacing.md,fontWeight:'500'},
  mode:{fontSize:9,lineHeight:12,color:colors.success,textAlign:'center',fontWeight:'900',letterSpacing:.7,marginTop:spacing.xs},
  status:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:spacing.xs},
  statusText:{...typography.caption,color:colors.yellow,fontWeight:'500'},
  error:{...typography.caption,color:colors.danger,textAlign:'center',fontWeight:'400'},
});
