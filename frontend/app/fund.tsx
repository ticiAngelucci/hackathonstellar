import {useCallback,useEffect,useState} from 'react';
import {router} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {ActivityIndicator,Image,Pressable,StyleSheet,Text,View} from 'react-native';
import {Screen} from '@/components/Screen';
import {PrimaryButton} from '@/components/PrimaryButton';
import {walletMode,walletService,type WalletAccount,type WalletBalance} from '@/services/wallet';
import {colors,radius,spacing,typography} from '@/constants/theme';

export default function Fund(){
  const [account,setAccount]=useState<WalletAccount|null>(null);
  const [balance,setBalance]=useState<WalletBalance|null>(null);
  const [loading,setLoading]=useState(true);
  const [funding,setFunding]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [txHash,setTxHash]=useState<string|null>(null);

  const refresh=useCallback(async()=>{
    setLoading(true);
    try{
      const nextAccount=await walletService.getAccount();
      setAccount(nextAccount);
      if(nextAccount)setBalance(await walletService.getBalance(nextAccount.walletAddress));
      setError(null);
    }catch(nextError){
      setError(nextError instanceof Error?nextError.message:'No pudimos consultar tu wallet.');
    }finally{
      setLoading(false);
    }
  },[]);

  useEffect(()=>{void refresh();},[refresh]);

  const fund=async()=>{
    if(funding||!account)return;
    setFunding(true);
    setError(null);
    try{
      const result=await walletService.fundTestnet(account.walletAddress);
      setTxHash(result.txHash??null);
      await refresh();
    }catch(nextError){
      setError(nextError instanceof Error?nextError.message:'Friendbot no pudo fondear la wallet.');
    }finally{
      setFunding(false);
    }
  };

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Volver" onPress={()=>router.back()} style={({pressed})=>[styles.headerButton,pressed&&styles.pressed]}>
          <Ionicons name="arrow-back" size={21} color={colors.text}/>
        </Pressable>
        <Text style={styles.headerTitle}>Cargar saldo</Text>
        <View style={styles.headerButton}/>
      </View>

      <View style={styles.hero}>
        <Image source={require('../assets/pato/pato-balance.png')} resizeMode="contain" style={styles.heroImage}/>
      </View>

      {loading?(
        <View style={styles.loading}><ActivityIndicator color={colors.yellow}/><Text style={styles.muted}>Consultando Stellar Testnet…</Text></View>
      ):(
        <View style={styles.card}>
          <Text style={styles.eyebrow}>{walletMode==='stellar'?'STELLAR TESTNET':'MODO MOCK'}</Text>
          {account?(
            <>
              <Text selectable numberOfLines={1} style={styles.address}>{account.walletAddress.slice(0,12)}…{account.walletAddress.slice(-10)}</Text>
              <Text style={styles.balance}>{balance?.formatted??'0'} <Text style={styles.asset}>{balance?.assetCode??'XLM'}</Text></Text>
              {!balance?.funded&&<Text style={styles.empty}>Tu wallet está creada, pero todavía no tiene fondos.</Text>}
            </>
          ):<Text style={styles.empty}>Primero creá tu wallet desde el onboarding.</Text>}
        </View>
      )}

      {walletMode==='stellar'&&<Text style={styles.devOnly}>Herramienta de desarrollo · Friendbot entrega fondos de prueba y nunca se usa en producción.</Text>}
      <PrimaryButton
        disabled={!account||funding||loading}
        title={funding?'Fondeando en Testnet…':'Fondear en Testnet'}
        icon="flask-outline"
        onPress={()=>void fund()}
      />
      {txHash&&<Text selectable style={styles.success}>Fondeo enviado · tx {txHash.slice(0,12)}…{txHash.slice(-8)}</Text>}
      {error&&<Text style={styles.error}>{error}</Text>}
    </Screen>
  );
}

const styles=StyleSheet.create({
  screen:{paddingHorizontal:spacing.sm,paddingTop:spacing.xxs,paddingBottom:spacing.xxl,gap:spacing.sm},
  header:{height:42,flexDirection:'row',alignItems:'center'},
  headerButton:{width:38,height:38,alignItems:'center',justifyContent:'center'},
  headerTitle:{...typography.bodyStrong,color:colors.text,flex:1,textAlign:'center',fontWeight:'800'},
  pressed:{opacity:.7},
  hero:{height:205,borderRadius:radius.md,backgroundColor:colors.bgSoft,borderWidth:1,borderColor:colors.border,alignItems:'center',justifyContent:'center',overflow:'hidden'},
  heroImage:{width:220,height:205},
  loading:{minHeight:140,alignItems:'center',justifyContent:'center',gap:spacing.xs},
  muted:{...typography.caption,color:colors.muted,fontWeight:'400'},
  card:{padding:spacing.md,borderRadius:radius.lg,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,alignItems:'center'},
  eyebrow:{fontSize:9,lineHeight:12,color:colors.success,fontWeight:'900',letterSpacing:1},
  address:{...typography.caption,color:colors.blueBright,marginTop:spacing.xs,fontWeight:'600'},
  balance:{fontSize:30,lineHeight:38,fontWeight:'900',color:colors.text,marginTop:spacing.sm},
  asset:{fontSize:14,color:colors.muted},
  empty:{...typography.caption,color:colors.yellow,textAlign:'center',marginTop:spacing.xs,fontWeight:'500'},
  devOnly:{...typography.caption,color:colors.muted,textAlign:'center',paddingHorizontal:spacing.md,fontWeight:'400'},
  success:{...typography.caption,color:colors.success,textAlign:'center',fontWeight:'500'},
  error:{...typography.caption,color:colors.danger,textAlign:'center',fontWeight:'400'},
});
