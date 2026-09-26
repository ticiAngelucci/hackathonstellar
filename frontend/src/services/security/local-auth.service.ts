import {DEMO_MODE,DEMO_PREFIX,demoWait,DEMO_TIMINGS} from '@/demo/demo.config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

const APP_LOCK_KEY=DEMO_MODE?DEMO_PREFIX+'app-lock':'patopay:security:app-lock-enabled:v1';

export type AppAuthenticationMode='biometric'|'device';

export async function isBiometricAvailable(){
  if(DEMO_MODE)return true;
  const [hasHardware,isEnrolled,types]=await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  return hasHardware&&isEnrolled&&types.length>0;
}

export function getSupportedAuthenticationTypes(){
  if(DEMO_MODE)return Promise.resolve([LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION]);
  return LocalAuthentication.supportedAuthenticationTypesAsync();
}

export async function isDeviceSecurityAvailable(){
  if(DEMO_MODE)return true;
  const level=await LocalAuthentication.getEnrolledLevelAsync();
  return level!==LocalAuthentication.SecurityLevel.NONE;
}

export function authenticate(mode:AppAuthenticationMode='device'){
  if(DEMO_MODE)return demoWait(DEMO_TIMINGS.medium).then(()=>({success:true as const}));
  const biometricOnly=mode==='biometric';
  return LocalAuthentication.authenticateAsync({
    promptMessage:'Desbloqueá Pato Pay',
    promptSubtitle:'Confirmá que sos vos',
    promptDescription:'Esto solo protege el acceso a la aplicación.',
    cancelLabel:'Cancelar',
    disableDeviceFallback:biometricOnly,
    fallbackLabel:biometricOnly?'':'Usar código del dispositivo',
  });
}

export async function isAppLockEnabled(){
  return await AsyncStorage.getItem(APP_LOCK_KEY)==='true';
}

export async function setAppLockEnabled(enabled:boolean){
  if(enabled){
    await AsyncStorage.setItem(APP_LOCK_KEY,'true');
    return;
  }
  await AsyncStorage.removeItem(APP_LOCK_KEY);
}
