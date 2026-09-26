import {useLocalSearchParams} from 'expo-router';
import {Text,View} from 'react-native';
import {Screen} from '@/components/Screen';
import {AppHeader} from '@/components/AppHeader';
import {LoadingCards} from '@/components/LoadingCards';
import {PrimaryButton} from '@/components/PrimaryButton';
import {PatoAgent} from '@/components/PatoAgent';
import {useGroupFund} from '@/hooks/useGroupFund';
import {userMessage} from '@/lib/errors';
import {colors,spacing,typography,radius} from '@/constants/theme';
export default function GroupFund(){
 const {id}=useLocalSearchParams<{id?:string}>();const query=useGroupFund(id);
 return <Screen><AppHeader title="Fondo común"/>{query.isLoading&&<LoadingCards/>}
 {query.error&&<><Text style={{color:colors.danger}}>{userMessage(query.error,'No pudimos consultar el fondo.')}</Text><PrimaryButton title="Reintentar" onPress={()=>void query.refetch()}/></>}
 {query.data&&<View style={{padding:spacing.lg,borderRadius:radius.lg,backgroundColor:colors.surface,alignItems:'center',gap:spacing.md}}>
 <PatoAgent size={150}/><Text style={{...typography.h2,color:colors.text}}>{query.data.groupName}</Text>
 <Text style={{...typography.h2,color:colors.yellow}}>{query.data.available?`${query.data.balance?.toFixed(2)} USDC`:'Disponible próximamente'}</Text>
 <Text style={{color:colors.muted,textAlign:'center'}}>{query.data.message}</Text>
 {query.data.available&&<Text style={{color:colors.success}}>{query.data.stakingLabel}</Text>}
 </View>}
 </Screen>;
}
