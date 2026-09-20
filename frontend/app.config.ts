import type {ConfigContext,ExpoConfig} from 'expo/config';
import appJson from './app.json';

export default ({config}:ConfigContext):ExpoConfig=>{
  const base=appJson.expo as ExpoConfig;
  const rpId=process.env.EXPO_PUBLIC_PASSKEY_RP_ID?.trim();

  return {
    ...config,
    ...base,
    plugins:[...(base.plugins??[]),'react-native-quick-crypto'],
    ios:{
      ...base.ios,
      bundleIdentifier:'com.patopay.mobile',
      associatedDomains:rpId?[`webcredentials:${rpId}`]:[],
    },
    android:{
      ...base.android,
      package:'com.patopay.mobile',
    },
  };
};
