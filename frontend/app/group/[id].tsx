import {useState} from 'react';
import {PrimaryButton} from '@/components/PrimaryButton';
import {useGroup,useUpdateGroup} from '@/hooks/useGroups';
import {userMessage} from '@/lib/errors';
import {LoadingCards} from '@/components/LoadingCards';
import {DEMO_MODE} from '@/demo/demo.config';
import {useLocalSearchParams,router} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {Alert,Image,Pressable,StyleSheet,Text,TextInput,View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {Screen} from '@/components/Screen';
import {ActionButton} from '@/components/ActionButton';
import {AnimatedCard} from '@/components/AnimatedCard';
import {groupImages} from '@/constants/groupImages';
import {colors,radius,spacing,typography} from '@/constants/theme';

const memberColors=['#FF9E68','#78C5E8','#F4C56A'];

export default function GroupDetail(){
  const {id,name,members,imageKey}=useLocalSearchParams<{id:string;name?:string;members?:string;imageKey?:string}>();
  const query=useGroup(id);
  const event=query.data;
  const update=useUpdateGroup();
  const [editing,setEditing]=useState(false);const [nextName,setNextName]=useState('');
  const canEdit=DEMO_MODE;
  const loadError=query.error?userMessage(query.error,'No pudimos abrir el grupo.'):null;
  const group={
    id,
    name:event?.name??name??'Grupo',
    members:event?.participants.length??Number(members??0),
    balance:event?.balance??0,
    stakingApy:0,
    imageKey,
  };
  const heroSource=groupImages[imageKey??group.imageKey??group.id]??groupImages.asado;

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Volver" onPress={()=>router.back()} style={({pressed})=>[styles.headerButton,pressed&&styles.pressed]}>
          <Ionicons name="arrow-back" size={21} color={colors.text}/>
        </Pressable>
        <Text numberOfLines={1} style={styles.headerTitle}>{group.name}</Text>
        <Pressable accessibilityLabel="Código del grupo" style={({pressed})=>[styles.headerButton,pressed&&styles.pressed]}>
          <Ionicons name="scan-outline" size={19} color={colors.muted}/>
        </Pressable>
      </View>

      {query.isLoading&&<LoadingCards/>}
      {loadError&&(
        <AnimatedCard style={styles.connectionError}>
          <Ionicons name="cloud-offline-outline" size={17} color={colors.danger}/>
          <Text numberOfLines={2} style={styles.connectionText}>{loadError}</Text>
        </AnimatedCard>
      )}

      <View style={styles.hero}>
        <Image source={heroSource} resizeMode="cover" style={styles.heroImage}/>
        <LinearGradient colors={['transparent','rgba(2,7,14,.76)']} style={styles.heroShade}/>
        <View style={styles.members}>
          {memberColors.map((backgroundColor,index)=>(
            <View key={backgroundColor} style={[styles.memberAvatar,{backgroundColor},index>0&&styles.memberOverlap]}>
              <Ionicons name="person" size={19} color={index===1?colors.surface2:colors.text}/>
            </View>
          ))}
          {group.members>3&&(
            <View style={[styles.memberAvatar,styles.moreMembers,styles.memberOverlap]}>
              <Text style={styles.moreMembersText}>+{group.members-3}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.identity}>
        <Text style={styles.title}>{group.name}</Text>
        <Text style={styles.meta}>{event?.membersVisible===false?'Grupo compartido':`${group.members} personas`}</Text>
      </View>

      <View style={styles.actions}>
        <ActionButton compact disabled={!DEMO_MODE} icon="person-add" label="Invitar" onPress={()=>Alert.alert("Invitar al grupo","Código de invitación: PATO-ASADO")}/>
        <ActionButton compact disabled={!DEMO_MODE} icon="wallet-outline" label="Pagar" onPress={()=>router.push('/payment/request')}/>
        <ActionButton compact icon="briefcase" label="Fondo" onPress={()=>router.push({pathname:'/group-fund',params:{id}})}/>
        <ActionButton compact disabled={!canEdit} icon="settings" label="Ajustes" onPress={()=>{setNextName(group.name);setEditing(true);}}/>
      </View>

      {editing&&<View style={{gap:12,marginBottom:16}}>
        <TextInput accessibilityLabel="Nombre del grupo" value={nextName} onChangeText={setNextName} maxLength={100} style={{color:colors.text,backgroundColor:colors.surface,padding:12}}/>
        <PrimaryButton title={update.isPending?'Guardando…':'Guardar nombre'} disabled={update.isPending||!nextName.trim()} onPress={()=>update.mutate({id,name:nextName,version:event?.version??1},{onSuccess:()=>setEditing(false)})}/>
        {update.error&&<Text style={{color:colors.danger}}>{userMessage(update.error)}</Text>}
      </View>}
      <AnimatedCard style={styles.fund} onPress={()=>router.push({pathname:'/group-fund',params:{id}})}>
        <View style={styles.fundTop}>
          <Text style={styles.label}>Fondo del grupo</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.muted}/>
        </View>
        <Text style={styles.balance}>{event?.balance===undefined?'Disponible próximamente':`${group.balance.toFixed(2)} USDC`}</Text>
        <View style={styles.apyRow}>
          <View style={styles.stakingInfo}>
            <Ionicons name="information-circle" size={15} color={colors.blueBright}/>
            <Text style={styles.staking}>{DEMO_MODE?'Con staking':'Rendimiento'}</Text>
          </View>
          <View style={styles.apyBadge}>
            <Text style={styles.apy}>{DEMO_MODE?'Staking activo':'Disponible próximamente'}</Text>
          </View>
        </View>
      </AnimatedCard>

      {!DEMO_MODE&&<Text style={styles.paymentSub}>Las invitaciones y los pagos de grupo estarán disponibles próximamente.</Text>}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Próximos pagos</Text>
        <Pressable style={({pressed})=>pressed&&styles.pressed}>
          <Text style={styles.sectionAction}>Ver todos <Ionicons name="chevron-forward" size={12}/></Text>
        </Pressable>
      </View>
      <AnimatedCard onPress={DEMO_MODE?()=>router.push('/payment/request'):undefined} delay={180} style={styles.emptyPayments}>
        <View style={styles.paymentIcon}><Ionicons name="checkmark-circle-outline" size={20} color={colors.success}/></View>
        <View style={styles.paymentCopy}>
          <Text style={styles.paymentTitle}>{DEMO_MODE?'Solicitud de pago · 10 USDC':'No hay pagos pendientes'}</Text>
          <Text style={styles.paymentSub}>{DEMO_MODE?'Te agregaron al asado. ¿Pagamos tu parte?':'Las solicitudes reales aparecerán acá.'}</Text>
        </View>
      </AnimatedCard>
    </Screen>
  );
}

const styles=StyleSheet.create({
  screen:{paddingHorizontal:spacing.sm,paddingTop:spacing.xxs,paddingBottom:spacing.xxl},
  header:{height:42,flexDirection:'row',alignItems:'center'},
  headerButton:{width:38,height:38,alignItems:'center',justifyContent:'center'},
  headerTitle:{...typography.bodyStrong,color:colors.text,flex:1,textAlign:'center',fontWeight:'800'},
  pressed:{opacity:.7},
  connectionError:{minHeight:48,marginVertical:spacing.xxs,paddingHorizontal:spacing.sm,flexDirection:'row',alignItems:'center',gap:spacing.xs,borderColor:'rgba(255,95,115,.24)',backgroundColor:'rgba(255,95,115,.08)'},
  connectionText:{fontSize:10,lineHeight:14,color:colors.muted,flex:1},
  hero:{height:142,marginTop:spacing.xxs,borderRadius:radius.md},
  heroImage:{width:'100%',height:'100%',borderRadius:radius.md,backgroundColor:colors.surface2},
  heroShade:{position:'absolute',left:0,right:0,bottom:0,height:72,borderBottomLeftRadius:radius.md,borderBottomRightRadius:radius.md},
  members:{position:'absolute',bottom:-18,left:0,right:0,flexDirection:'row',justifyContent:'center',alignItems:'center'},
  memberAvatar:{width:38,height:38,borderRadius:19,borderWidth:2,borderColor:colors.bg,alignItems:'center',justifyContent:'center'},
  memberOverlap:{marginLeft:-9},
  moreMembers:{backgroundColor:colors.surface2},
  moreMembersText:{...typography.caption,color:colors.text,fontWeight:'900'},
  identity:{alignItems:'center',marginTop:spacing.xl},
  title:{...typography.h3,color:colors.text,fontSize:17},
  meta:{...typography.caption,color:colors.muted,marginTop:1,fontWeight:'400'},
  actions:{flexDirection:'row',gap:spacing.xxs,marginTop:spacing.sm,marginBottom:spacing.md},
  fund:{padding:spacing.sm,borderRadius:radius.md,marginBottom:spacing.md},
  fundTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  label:{...typography.caption,color:colors.text,fontWeight:'400'},
  balance:{fontSize:25,lineHeight:30,fontWeight:'900',color:colors.text,marginTop:1},
  asset:{fontSize:14,lineHeight:19,fontWeight:'800'},
  apyRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:spacing.xs},
  stakingInfo:{flexDirection:'row',alignItems:'center',gap:4},
  staking:{...typography.caption,color:colors.blueBright,fontWeight:'400'},
  apyBadge:{paddingHorizontal:spacing.xs,paddingVertical:5,borderRadius:radius.pill,backgroundColor:'rgba(30,215,164,.12)'},
  apy:{fontSize:11,lineHeight:14,color:colors.success,fontWeight:'900'},
  sectionHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:spacing.xs},
  sectionTitle:{...typography.bodyStrong,color:colors.text,fontSize:14},
  sectionAction:{...typography.caption,color:colors.blueBright,fontWeight:'700'},
  emptyPayments:{padding:spacing.sm,flexDirection:'row',alignItems:'center',gap:spacing.sm,borderRadius:radius.md,backgroundColor:colors.bgSoft},
  paymentIcon:{width:38,height:38,borderRadius:radius.pill,backgroundColor:colors.surface2,alignItems:'center',justifyContent:'center'},
  paymentCopy:{flex:1},
  paymentTitle:{...typography.caption,color:colors.text,fontWeight:'700'},
  paymentSub:{fontSize:10,lineHeight:13,color:colors.muted,marginTop:1},
});
