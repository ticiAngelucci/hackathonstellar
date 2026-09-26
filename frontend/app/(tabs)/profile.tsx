import {useEffect,useState} from 'react';
import {DEMO_MODE} from '@/demo/demo.config';
import {useProfile,useUpdateProfile} from '@/hooks/useProfile';
import {authService} from '@/services/auth/auth.service';
import {profileService} from '@/services/users/profile.service';
import {PrimaryButton} from '@/components/PrimaryButton';
import {userMessage} from '@/lib/errors';
import type {PublicWallet} from '@/types/domain';
import {useOnboarding} from '@/features/onboarding/store/OnboardingProvider';
import {router} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {StyleSheet,Switch,Text,TextInput,View} from 'react-native';
import {Screen} from '@/components/Screen';
import {PatoAvatar} from '@/components/PatoAvatar';
import {AnimatedCard} from '@/components/AnimatedCard';
import {colors,radius,spacing,typography} from '@/constants/theme';

const items=[
  ['Reglas del agente','options','/permissions'],
  ['Métodos de pago','card',null],
  ['Notificaciones','notifications',null],
  ['Ayuda','help-circle',null],
  ['Configuración','settings',null],
] as const;

export default function Profile(){
  const {profile}=useOnboarding();
  const remote=useProfile();const update=useUpdateProfile();
  const [editing,setEditing]=useState(false);const [name,setName]=useState('');const [username,setUsername]=useState('');const [error,setError]=useState('');const [wallets,setWallets]=useState<PublicWallet[]>([]);
  useEffect(()=>{if(!DEMO_MODE)void profileService.getWallets().then(setWallets).catch(()=>{});},[]);
  const shown=DEMO_MODE?profile:remote.data;
  const save=async()=>{try{await update.mutateAsync({displayName:name,username,notificationsEnabled:remote.data?.notificationsEnabled??false});setEditing(false);setError('');}catch(e){setError(userMessage(e));}};
  const logout=async()=>{try{await authService.signOut();router.replace('/auth');}catch(e){setError(userMessage(e));}};
  return (
    <Screen>
      <View style={styles.hero}>
        <PatoAvatar size={96}/>
        <Text style={styles.name}>{shown?.displayName.trim()||'Mi perfil'}</Text>
        <View style={styles.statusRow}><View style={styles.statusDot}/><Text style={styles.status}>{DEMO_MODE?'Tu agente está activo':'Tu cuenta de Pato Pay'}</Text></View>
      </View>
      {!!shown?.username&&<Text style={{color:colors.muted,textAlign:'center',marginBottom:12}}>@{shown.username}</Text>}
      {!DEMO_MODE&&<View style={{gap:12,marginBottom:20}}>
        {remote.error&&<><Text style={{color:colors.danger}}>{userMessage(remote.error,'No pudimos cargar tu perfil.')}</Text><PrimaryButton title="Reintentar" onPress={()=>void remote.refetch()}/></>}
        {wallets.map(wallet=><Text key={wallet.id} style={{color:colors.muted}}>Wallet · {wallet.address.slice(0,8)}…{wallet.address.slice(-6)} · {wallet.status==='active'?'Activa':'Pendiente de verificación'}</Text>)}
        {editing?<>
          <TextInput accessibilityLabel="Nombre" value={name} onChangeText={setName} style={{color:colors.text,padding:12,backgroundColor:colors.surface}}/>
          <TextInput accessibilityLabel="Username" value={username} onChangeText={setUsername} autoCapitalize="none" style={{color:colors.text,padding:12,backgroundColor:colors.surface}}/>
          <PrimaryButton title={update.isPending?'Guardando…':'Guardar perfil'} disabled={update.isPending||!name.trim()||!username.trim()} onPress={()=>void save()}/>
        </>:<PrimaryButton title="Editar perfil" onPress={()=>{setName(shown?.displayName??'');setUsername(shown?.username??'');setEditing(true);}}/>}
        {remote.data&&<View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={{color:colors.text}}>Notificaciones</Text><Switch accessibilityLabel="Notificaciones" disabled={update.isPending} value={remote.data.notificationsEnabled} onValueChange={notificationsEnabled=>update.mutate({...remote.data!,notificationsEnabled},{onError:e=>setError(userMessage(e))})}/></View>}
        <PrimaryButton variant="secondary" title="Cerrar sesión" onPress={()=>void logout()}/>
        {!!error&&<Text style={{color:colors.danger}}>{error}</Text>}
      </View>}
      <View style={styles.list}>
        {items.map(([label,icon,route],index)=>(
          <AnimatedCard key={label} delay={index*45} style={styles.item} onPress={()=>route&&router.push(route)}>
            <View style={styles.icon}><Ionicons name={icon} size={19} color={colors.yellow}/></View>
            <Text style={styles.itemText}>{label}</Text>
            <Ionicons name="chevron-forward" size={17} color={colors.muted}/>
          </AnimatedCard>
        ))}
      </View>
    </Screen>
  );
}

const styles=StyleSheet.create({
  hero:{alignItems:'center',marginBottom:spacing.xl},
  name:{...typography.h2,color:colors.text,marginTop:spacing.sm},
  statusRow:{flexDirection:'row',alignItems:'center',gap:6,marginTop:spacing.xxs},
  statusDot:{width:7,height:7,borderRadius:4,backgroundColor:colors.success},
  status:{...typography.small,color:colors.success},
  list:{gap:spacing.xs},
  item:{minHeight:58,paddingHorizontal:spacing.sm,paddingVertical:spacing.xs,flexDirection:'row',alignItems:'center',gap:spacing.sm,borderRadius:radius.md},
  icon:{width:38,height:38,borderRadius:radius.sm,backgroundColor:colors.bgSoft,alignItems:'center',justifyContent:'center'},
  itemText:{...typography.bodyStrong,color:colors.text,flex:1},
});
