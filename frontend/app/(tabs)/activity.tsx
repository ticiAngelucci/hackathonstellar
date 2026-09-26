import {useTransactions} from '@/hooks/useTransactions';
import {LoadingCards} from '@/components/LoadingCards';
import {userMessage} from '@/lib/errors';
import {useFocusEffect} from 'expo-router';
import {useCallback,useMemo,useState} from 'react';
import {Ionicons} from '@expo/vector-icons';
import {Linking,Pressable,StyleSheet,Text,View} from 'react-native';
import Animated,{FadeInDown,Layout} from 'react-native-reanimated';
import {Screen} from '@/components/Screen';
import {StatusBadge} from '@/components/StatusBadge';
import {TransactionStatus} from '@/types';
import {colors,radius,spacing,typography} from '@/constants/theme';

type Filter='Todas'|'Pagos'|'Solicitudes'|'Auto';
const filters:Filter[]=['Todas','Pagos','Solicitudes','Auto'];
const allowedStatuses:Record<Exclude<Filter,'Todas'>,TransactionStatus[]>={
  Pagos:['paid','received'],
  Solicitudes:['pending','approved','rejected','blocked','expired','cancelled'],
  Auto:['auto'],
};

export default function Activity(){
  const [filter,setFilter]=useState<Filter>('Todas');
  const query=useTransactions();
  const transactions=useMemo(()=>query.data??[],[query.data]);
  const loading=query.isLoading;const error=query.error?userMessage(query.error,'No pudimos cargar tu actividad.'):null;
  const refresh=query.refetch;
  const visible=useMemo(()=>filter==='Todas'?transactions:transactions.filter(tx=>allowedStatuses[filter].includes(tx.status)),[filter,transactions]);

  useFocusEffect(useCallback(()=>{void refresh();},[refresh]));

  return (
    <Screen>
      <Text style={styles.title}>Actividad</Text>
      <View style={styles.filters}>
        {filters.map(item=>{
          const selected=filter===item;
          return (
            <Pressable key={item} onPress={()=>setFilter(item)} style={[styles.pill,selected&&styles.pillSelected]}>
              <Text style={[styles.pillText,selected&&styles.pillTextSelected]}>{item}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.list}>
        {loading&&<LoadingCards/>}
        {!loading&&error&&(
          <Animated.View entering={FadeInDown.duration(240)} style={styles.state}>
            <Ionicons name="cloud-offline-outline" size={22} color={colors.danger}/>
            <Text style={styles.stateText}>{error}</Text>
            <Pressable onPress={()=>void refresh()}><Text style={styles.retry}>Reintentar</Text></Pressable>
          </Animated.View>
        )}
        {!loading&&!error&&visible.length===0&&(
          <Animated.View entering={FadeInDown.duration(260)} style={styles.state}>
            <Ionicons name="receipt-outline" size={23} color={colors.muted}/>
            <Text style={styles.stateText}>{transactions.length===0?'Todavía no hay movimientos.':'No hay movimientos con este filtro.'}</Text>
          </Animated.View>
        )}
        {visible.map((tx,index)=>(
          <Animated.View entering={FadeInDown.delay(index*45).duration(260)} layout={Layout.duration(200)} key={tx.id} style={[styles.row,index===visible.length-1&&styles.last]}>
            <View style={styles.icon}>
              <Ionicons name={tx.icon as keyof typeof Ionicons.glyphMap} size={20} color={colors.yellow}/>
            </View>
            <View style={styles.copy}>
              <Text numberOfLines={1} style={styles.name}>{tx.title}</Text>
              <Text style={styles.sub}>{tx.subtitle}</Text>
              {tx.txHash&&/^[a-fA-F0-9]{64}$/.test(tx.txHash)&&<Pressable onPress={()=>void Linking.openURL(`https://stellar.expert/explorer/testnet/tx/${tx.txHash}`)}><Text style={styles.retry}>Ver en explorer →</Text></Pressable>}
            </View>
            <View style={styles.trailing}>
              <Text style={[styles.amount,tx.amount>0&&styles.income]}>{tx.displayAmount??`${tx.amount>0?'+':''}${tx.amount.toFixed(2)}`} {tx.assetCode??'USDC'}</Text>
              <StatusBadge status={tx.status}/>
            </View>
          </Animated.View>
        ))}
      </View>
    </Screen>
  );
}

const styles=StyleSheet.create({
  title:{...typography.h1,color:colors.text},
  filters:{flexDirection:'row',gap:spacing.xs,marginTop:spacing.lg,marginBottom:spacing.md},
  pill:{paddingHorizontal:spacing.sm,paddingVertical:8,borderRadius:radius.pill,backgroundColor:colors.bgSoft,borderWidth:1,borderColor:colors.border},
  pillSelected:{backgroundColor:colors.yellow,borderColor:colors.yellow},
  pillText:{...typography.caption,color:colors.muted},
  pillTextSelected:{color:colors.black},
  list:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,paddingHorizontal:spacing.md},
  state:{minHeight:180,alignItems:'center',justifyContent:'center',gap:spacing.xs,padding:spacing.lg},
  stateText:{...typography.small,color:colors.muted,textAlign:'center'},
  retry:{...typography.caption,color:colors.yellow},
  row:{minHeight:72,flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderBottomColor:colors.border,gap:spacing.sm},
  last:{borderBottomWidth:0},
  icon:{width:40,height:40,borderRadius:radius.sm,backgroundColor:colors.bgSoft,alignItems:'center',justifyContent:'center'},
  copy:{flex:1},
  name:{...typography.bodyStrong,color:colors.text,fontSize:14},
  sub:{...typography.caption,color:colors.muted,marginTop:1},
  trailing:{alignItems:'flex-end',gap:4},
  amount:{...typography.caption,color:colors.text},
  income:{color:colors.success},
});
