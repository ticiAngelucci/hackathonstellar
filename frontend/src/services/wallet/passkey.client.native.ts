import type {PasskeyKitConfig} from 'passkey-kit';
import type {PasskeyCreateRequest,PasskeyGetRequest} from 'react-native-passkey';

type WebAuthnClient=NonNullable<PasskeyKitConfig['WebAuthn']>;

export async function isNativePasskeySupported(){
  try{
    const {Passkey}=await import('react-native-passkey');
    return Passkey.isSupported();
  }catch{
    return false;
  }
}

export async function getPasskeyClient():Promise<WebAuthnClient>{
  const {Passkey}=await import('react-native-passkey');
  if(!Passkey.isSupported()){
    throw new Error('Este dispositivo no soporta passkeys. Probá con un Development Build en un dispositivo compatible.');
  }

  return {
    startRegistration:async({optionsJSON})=>{
      const response=await Passkey.createPlatformKey(optionsJSON as PasskeyCreateRequest);
      return response as unknown as Awaited<ReturnType<WebAuthnClient['startRegistration']>>;
    },
    startAuthentication:async({optionsJSON})=>{
      const response=await Passkey.getPlatformKey(optionsJSON as PasskeyGetRequest);
      return response as unknown as Awaited<ReturnType<WebAuthnClient['startAuthentication']>>;
    },
  };
}
