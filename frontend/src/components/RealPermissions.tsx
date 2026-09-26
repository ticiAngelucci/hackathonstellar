import {useEffect,useState} from 'react';
import {StyleSheet,Switch,Text,TextInput,View} from 'react-native';
import {Screen} from './Screen';
import {AppHeader} from './AppHeader';
import {PrimaryButton} from './PrimaryButton';
import {LoadingCards} from './LoadingCards';
import {usePolicy,useSavePolicy} from '@/hooks/usePolicy';
import {profileService} from '@/services/users/profile.service';
import {decimalToMinorUnits,formatMinorUnits} from '@/services/api/money';
import {userMessage} from '@/lib/errors';
import {colors,spacing,radius} from '@/constants/theme';
export function RealPermissions(){
 const query=usePolicy(),mutation=useSavePolicy();
 const [auto,setAuto]=useState('0'),[approval,setApproval]=useState('0'),[daily,setDaily]=useState('0');
 const [allowlist,setAllowlist]=useState(true),[recipients,setRecipients]=useState<string[]>([]);
 const [username,setUsername]=useState(''),[message,setMessage]=useState(''),[looking,setLooking]=useState(false);
 useEffect(()=>{const p=query.data;if(!p?.minorLimits)return;setAuto(formatMinorUnits(p.minorLimits.auto));setApproval(formatMinorUnits(p.minorLimits.approval));setDaily(formatMinorUnits(p.minorLimits.daily));setAllowlist(p.allowedRecipientsOnly);setRecipients(p.allowedRecipientIds??[]);},[query.data]);
 const save=async()=>{if(!query.data)return;setMessage('');try{await mutation.mutateAsync({...query.data,allowedRecipientsOnly:allowlist,allowedRecipientIds:recipients,minorLimits:{auto:decimalToMinorUnits(auto),approval:decimalToMinorUnits(approval),daily:decimalToMinorUnits(daily)}});setMessage('Tus reglas quedaron guardadas.');}catch(error){setMessage(userMessage(error));}};
 const add=async()=>{setLooking(true);setMessage('');try{const p=await profileService.findProfile(username);setRecipients(ids=>ids.includes(p.id)?ids:[...ids,p.id]);setUsername('');}catch(error){setMessage(userMessage(error));}finally{setLooking(false);}};
 const busy=mutation.isPending||looking;
 return <Screen><AppHeader title="Permisos de pago"/>
 {query.isLoading&&<LoadingCards/>}
 {query.error&&<Text style={s.error}>{userMessage(query.error)}</Text>}
 <PrimaryButton variant="secondary" title="Actualizar reglas" disabled={busy} onPress={()=>void query.refetch()}/>
 {query.data&&<View style={s.form}>
 <Text style={s.text}>{query.data.notice}</Text>
 {([['Autopagar hasta (USDC)',auto,setAuto],['Pedir aprobación hasta (USDC)',approval,setApproval],['Límite diario (USDC)',daily,setDaily]] as const).map(([label,value,setter])=><View key={label}><Text style={s.text}>{label}</Text><TextInput accessibilityLabel={label} keyboardType="decimal-pad" value={value} onChangeText={setter} editable={!busy} style={s.input}/></View>)}
 <Text style={s.text}>Por encima del límite de aprobación, el pago queda bloqueado.</Text>
 <View style={s.row}><Text style={s.text}>Solo destinatarios permitidos</Text><Switch value={allowlist} disabled={busy} onValueChange={setAllowlist}/></View>
 {allowlist&&<><Text style={s.text}>Agregá usuarios por su nombre. Una lista vacía no permite destinatarios.</Text><TextInput accessibilityLabel="Usuario permitido" placeholder="@usuario" placeholderTextColor={colors.muted} autoCapitalize="none" value={username} onChangeText={setUsername} editable={!busy} style={s.input}/><PrimaryButton variant="secondary" title="Agregar usuario" disabled={busy||!username.trim()} onPress={()=>void add()}/>{recipients.map(id=><View key={id}><Text style={s.text}>{id}</Text><PrimaryButton variant="secondary" title="Quitar destinatario" disabled={busy} onPress={()=>setRecipients(ids=>ids.filter(value=>value!==id))}/></View>)}</>}
 <PrimaryButton title={mutation.isPending?'Guardando…':'Guardar cambios'} disabled={busy} onPress={()=>void save()}/>
 </View>}
 {!!message&&<Text style={s.text}>{message}</Text>}
 </Screen>;
}
const s=StyleSheet.create({form:{gap:spacing.md,marginVertical:spacing.md},input:{color:colors.text,backgroundColor:colors.surface,borderRadius:radius.md,padding:spacing.md,marginTop:8},text:{color:colors.muted},error:{color:colors.danger},row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}});
