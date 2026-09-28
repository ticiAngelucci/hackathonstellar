import {useCallback,useEffect,useState} from 'react';
import {Redirect} from 'expo-router';
import {Text,View} from 'react-native';
import {Screen} from '@/components/Screen';
import {AppHeader} from '@/components/AppHeader';
import {PrimaryButton} from '@/components/PrimaryButton';
import {env} from '@/config/env';
import {useAuth} from '@/features/auth/AuthProvider';
import {checkBackendConnection,type BackendHealth} from '@/services/health/backend-health';
import {colors,spacing} from '@/constants/theme';

export default function DeveloperStatus(){
  const {session}=useAuth();
  const [health,setHealth]=useState<BackendHealth>();
  const refresh=useCallback(()=>{void checkBackendConnection().then(setHealth);},[]);
  useEffect(refresh,[refresh]);
  if(!__DEV__)return <Redirect href="/"/>;
  const rows=[
    ['Mode',env.demoMode?'DEMO':'REAL'],
    ['Supabase',health?.connected===null?'Not used':health?.connected===undefined?'Checking…':health.connected?'Connected':'Failed'],
    ['Auth',session?'Logged in':'Logged out'],
    ['User ID',session?.user.id??'—'],
    ['Environment','development'],
    ['Wallet mode',env.demoMode?'mock':env.walletMode],
  ];
  return <Screen><AppHeader title="Developer / Backend Status"/><View style={{gap:spacing.md}}>
    {rows.map(([label,value])=><View key={label} style={{gap:4}}><Text style={{color:colors.muted}}>{label}</Text><Text selectable style={{color:colors.text}}>{value}</Text></View>)}
    <PrimaryButton title="Refresh" onPress={refresh}/>
  </View></Screen>;
}
