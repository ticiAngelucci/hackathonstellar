import {userMessage} from '@/lib/errors';
import {DEMO_MODE} from '@/demo/demo.config';
import {useEffect,useState} from 'react';
import {router,useLocalSearchParams} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {ActivityIndicator,Linking,Pressable,StyleSheet,Text,View} from 'react-native';
import Animated,{useAnimatedStyle,useSharedValue,withDelay,withSpring,withTiming} from 'react-native-reanimated';
import {Screen} from '@/components/Screen';
import {PrimaryButton} from '@/components/PrimaryButton';
import {transactionService} from '@/services/appDataService';
import {walletService} from '@/services/wallet';
import type {Transaction} from '@/types';
import {colors,radius,spacing,typography} from '@/constants/theme';

const wait=(duration:number)=>new Promise(resolve=>setTimeout(resolve,duration));

export default function Success(){
  const {id,txHash,amount,asset,recipient}=useLocalSearchParams<{
    id?:string;
    txHash?:string;
    amount?:string;
    asset?:string;
    recipient?:string;
  }>();
  const blockchainFlow=Boolean(txHash);
  const [showDemoExplorer,setShowDemoExplorer]=useState(false);
  const [transaction,setTransaction]=useState<Transaction|null>(null);
  const [confirmed,setConfirmed]=useState(false);
  const [explorerUrl,setExplorerUrl]=useState('');
  const [loading,setLoading]=useState(Boolean(id||txHash));
  const [error,setError]=useState<string|null>(id||txHash?null:'No recibimos una transacción para validar.');
  const opacity=useSharedValue(0);
  const scale=useSharedValue(.85);
  const checkScale=useSharedValue(0);
  const entrance=useAnimatedStyle(()=>({opacity:opacity.value,transform:[{scale:scale.value}]}));
  const checkEntrance=useAnimatedStyle(()=>({transform:[{scale:checkScale.value}]}));

  useEffect(()=>{
    let active=true;

    const validate=async()=>{
      if(txHash){
        for(let attempt=0;attempt<8;attempt+=1){
          const result=await walletService.getTransactionStatus(txHash);
          if(!active)return;
          setExplorerUrl(result.explorerUrl);
          if(result.status==='success'){
            setConfirmed(true);
            setError(null);
            return;
          }
          if(result.status==='failed'){
            setError('Stellar confirmó que la transacción falló.');
            return;
          }
          await wait(1500);
        }
        if(active)setError('La transacción sigue pendiente en Stellar Testnet.');
        return;
      }

      if(id){
        const result=await transactionService.get(id);
        if(!active)return;
        if(!result.txHash||(result.status!=='paid'&&result.status!=='auto'&&result.status!=='received')){
          setError('La transacción todavía no está confirmada.');
          return;
        }
        if(!DEMO_MODE){
          const chain=await walletService.getTransactionStatus(result.txHash);
          if(!active)return;
          if(chain.status!=='success'){setError('El pago todavía no tiene confirmación en Stellar.');return;}
          setExplorerUrl(chain.explorerUrl);
        }
        setTransaction(result);
        setConfirmed(true);
        setError(null);
      }
    };

    validate()
      .catch(nextError=>{if(active)setError(userMessage(nextError,'No pudimos confirmar el pago.'));})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[id,txHash]);

  useEffect(()=>{
    if(!confirmed)return;
    opacity.value=withTiming(1,{duration:420});
    scale.value=withSpring(1,{damping:12,stiffness:110});
    checkScale.value=withDelay(180,withSpring(1,{damping:11,stiffness:150}));
  },[checkScale,confirmed,opacity,scale]);

  if(loading||!confirmed){
    return (
      <Screen scroll={false} contentStyle={styles.screen}>
        <View style={styles.content}>
          {loading?<ActivityIndicator size="large" color={colors.yellow}/>:<View style={styles.invalidIcon}><Ionicons name="alert-circle-outline" size={30} color={colors.yellow}/></View>}
          <Text style={styles.invalidTitle}>{loading?'Confirmando tu pago…':'Sin confirmación'}</Text>
          <Text style={styles.invalidText}>{loading?'Consultando el estado del pago.':error??'No encontramos una transacción confirmada.'}</Text>
        </View>
        <PrimaryButton title="Volver al inicio" onPress={()=>router.replace('/(tabs)')}/>
      </Screen>
    );
  }

  const shownAmount=blockchainFlow?amount??'0':Math.abs(transaction?.amount??0).toFixed(2);
  const shownAsset=blockchainFlow?asset??'XLM':transaction?.assetCode??'USDC';
  const shownRecipient=blockchainFlow
    ?recipient?`${recipient.slice(0,9)}…${recipient.slice(-7)}`:'Stellar Testnet'
    :transaction?.title==='Asado del viernes'?'del asado del viernes':transaction?.title??'Pago';

  return (
    <Screen scroll={false} contentStyle={styles.screen}>
      <View style={styles.content}>
        <Animated.Image source={require('../../assets/pato/pato-success.png')} style={[styles.pato,entrance]} resizeMode="contain"/>
        <Text style={styles.title}>¡Listo!</Text>
        <Text style={styles.sub}>Pagaste {shownAmount} {shownAsset}{`\n`}{shownRecipient}.</Text>
        <View style={styles.card}>
          <Animated.View style={[styles.check,checkEntrance]}><Ionicons name="checkmark" size={28} color={colors.bg}/></Animated.View>
          <View style={styles.cardCopy}>
            <Text style={styles.cardTitle}>{DEMO_MODE?'Transacción completada':blockchainFlow?'Confirmada en Stellar Testnet':'Transacción completada'}</Text>
            {!DEMO_MODE&&(txHash||transaction?.txHash)&&<Text numberOfLines={1} style={styles.hash}>{DEMO_MODE?(txHash??transaction?.txHash):`${txHash?.slice(0,12)}…${txHash?.slice(-10)}`}</Text>}
            {(explorerUrl||DEMO_MODE)&&(
              <Pressable onPress={()=>DEMO_MODE?setShowDemoExplorer(true):void Linking.openURL(explorerUrl)}>
                <Text style={styles.link}>{DEMO_MODE?'Ver detalle →':'Ver en explorer →'}</Text>
              </Pressable>
            )}
            {showDemoExplorer&&<Text style={styles.hash}>Pago completado · {shownAmount} {shownAsset}</Text>}
          </View>
        </View>
      </View>
      <PrimaryButton title="Volver al inicio" onPress={()=>router.replace('/(tabs)')}/>
    </Screen>
  );
}

const styles=StyleSheet.create({
  screen:{padding:spacing.xl,justifyContent:'space-between'},
  content:{alignItems:'center',justifyContent:'center',flex:1},
  pato:{width:220,height:220},
  title:{...typography.hero,color:colors.text},
  sub:{...typography.body,color:colors.text,textAlign:'center',marginTop:spacing.xs},
  card:{width:'100%',marginTop:spacing.xl,backgroundColor:colors.surface,borderRadius:radius.lg,padding:spacing.md,flexDirection:'row',alignItems:'center',gap:spacing.sm,borderWidth:1,borderColor:colors.border},
  check:{width:50,height:50,borderRadius:radius.pill,backgroundColor:colors.success,alignItems:'center',justifyContent:'center'},
  cardCopy:{flex:1},
  cardTitle:{...typography.bodyStrong,color:colors.text},
  hash:{...typography.caption,color:colors.muted,marginTop:spacing.xxs,fontWeight:'400'},
  link:{...typography.small,color:colors.yellow,marginTop:spacing.xxs,fontWeight:'700'},
  invalidIcon:{width:60,height:60,borderRadius:radius.pill,alignItems:'center',justifyContent:'center',backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},
  invalidTitle:{...typography.h2,color:colors.text,marginTop:spacing.md},
  invalidText:{...typography.body,color:colors.muted,textAlign:'center',marginTop:spacing.xs,maxWidth:300},
});
