import {CreatePaymentRequest} from './CreatePaymentRequest';
import {router,useLocalSearchParams} from 'expo-router';
import {Text,View} from 'react-native';
import {Screen} from './Screen';
import {AppHeader} from './AppHeader';
import {AnimatedCard} from './AnimatedCard';
import {PrimaryButton} from './PrimaryButton';
import {LoadingCards} from './LoadingCards';
import {usePaymentRequests,usePaymentRequest} from '@/hooks/usePaymentRequests';
import {useAuth} from '@/features/auth/AuthProvider';
import {userMessage} from '@/lib/errors';
import {colors,spacing,typography} from '@/constants/theme';
import type {PaymentRequestStatus} from '@/types/domain';
export const requestLabels:Record<PaymentRequestStatus,string>={pending:'Pendiente de aprobación',approved:'Aprobada · todavía no pagada',processing:'Procesando',paid:'Pago registrado',rejected:'Rechazada',blocked:'Bloqueada por las reglas',failed:'El pago no se completó',expired:'Vencida',cancelled:'Cancelada'};
export function RealPaymentRequests(){
 const {id}=useLocalSearchParams<{id?:string}>();const list=usePaymentRequests();const detail=usePaymentRequest(id);const {session}=useAuth();
 const query=id?detail:list;const requests=id?(detail.data?[detail.data]:[]):list.data??[];
 return <Screen><AppHeader title="Solicitudes de pago"/>
 {!id&&<CreatePaymentRequest/>}
 {query.isLoading&&<LoadingCards/>}
 {query.error&&<><Text style={{color:colors.danger}}>{userMessage(query.error,'No pudimos cargar tus solicitudes.')}</Text><PrimaryButton title="Reintentar" onPress={()=>void query.refetch()}/></>}
 {!query.isLoading&&!query.error&&!requests.length&&<Text style={{color:colors.muted}}>No tenés solicitudes pendientes.</Text>}
 <View style={{gap:spacing.md}}>{requests.map(request=><AnimatedCard key={request.id} onPress={id?undefined:()=>router.push({pathname:'/payment/request',params:{id:request.id}})} style={{padding:spacing.lg}}>
 <Text style={{...typography.h3,color:colors.text}}>{request.concept}</Text>
 <Text style={{...typography.hero,color:colors.text}}>{request.amount} {request.asset}</Text>
 <Text style={{color:colors.muted}}>{request.payerId===session?.user.id?'Te pidieron un pago':'Pediste un pago'}{request.createdAt?` · ${new Date(request.createdAt).toLocaleDateString('es-AR')}`:''}</Text>
 <Text style={{color:request.status==='blocked'||request.status==='failed'?colors.danger:colors.yellow,marginVertical:12}}>{requestLabels[request.status]}</Text>
 {id&&request.status==='pending'&&<><Text style={{color:colors.muted}}>La aprobación y el rechazo de solicitudes todavía no están disponibles.</Text><PrimaryButton disabled title="Aprobar y pagar" onPress={()=>{}}/><PrimaryButton disabled variant="secondary" title="Rechazar" onPress={()=>{}}/></>}
 {id&&request.status==='paid'&&request.txHash&&<PrimaryButton title="Ver comprobante" onPress={()=>router.push({pathname:'/payment/success',params:{txHash:request.txHash,amount:request.amount,asset:request.asset}})}/>}
 </AnimatedCard>)}</View>
 </Screen>;
}
