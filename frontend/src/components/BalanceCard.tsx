import {router} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {colors,gradients,radius,spacing,typography} from '@/constants/theme';

export function BalanceCard({balance,assetCode='USDC',onAdd}:{balance:number|null;assetCode?:string;onAdd?:()=>void}){
  return (
    <LinearGradient colors={gradients.balance} style={styles.card}>
      <View style={styles.top}>
        <Pressable accessibilityRole="link" hitSlop={8} onPress={()=>router.push('/permissions')}>
          <Text style={styles.label}>Tu saldo</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Agregar saldo"
          accessibilityRole="button"
          onPress={onAdd}
          style={({pressed})=>[styles.add,pressed&&styles.pressed]}
        >
          <Ionicons name="add" size={22} color={colors.black}/>
        </Pressable>
      </View>
      <View style={styles.row}>
        <Text style={styles.amount}>{balance?.toFixed(2)??'—'}</Text>
        <Text style={styles.asset}>{assetCode}</Text>
      </View>
    </LinearGradient>
  );
}

const styles=StyleSheet.create({
  card:{borderRadius:radius.md,paddingHorizontal:spacing.md,paddingVertical:spacing.sm,borderWidth:1,borderColor:colors.border},
  top:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  label:{...typography.small,color:colors.muted,fontWeight:'700'},
  add:{width:36,height:36,borderRadius:radius.pill,alignItems:'center',justifyContent:'center',backgroundColor:colors.yellow},
  pressed:{opacity:.78,transform:[{scale:.96}]},
  row:{flexDirection:'row',alignItems:'baseline',gap:spacing.xs,marginTop:-spacing.xs},
  amount:{color:colors.text,fontSize:34,lineHeight:42,fontWeight:'900'},
  asset:{color:colors.text,fontSize:15,fontWeight:'700'},
});
