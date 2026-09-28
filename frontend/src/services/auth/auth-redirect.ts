import Constants,{ExecutionEnvironment} from 'expo-constants';
import * as Linking from 'expo-linking';
import {Platform} from 'react-native';

export const STABLE_AUTH_REDIRECT_URL='patopay://auth/callback';

export function isExpoGo(){
  return Constants.executionEnvironment===ExecutionEnvironment.StoreClient;
}

export function getAuthRedirectUrl(){
  if(isExpoGo()||Platform.OS==='web')return Linking.createURL('/auth/callback');
  return STABLE_AUTH_REDIRECT_URL;
}
