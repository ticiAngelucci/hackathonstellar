import {profileService} from '@/services/users/profile.service';
import {markOnboardingCompleted} from '@/features/onboarding/services/onboardingStorage';
import {userMessage} from '@/lib/errors';
import {useAuth} from '@/features/auth/AuthProvider';
import {DEMO_MODE} from '@/demo/demo.config';
import {useEffect,useState} from 'react';
import {router} from 'expo-router';
import {StyleSheet,Text,TextInput,View,useWindowDimensions} from 'react-native';
import {PrimaryButton} from '@/components/PrimaryButton';
import {OnboardingCopy} from '@/features/onboarding/components/OnboardingCopy';
import {OnboardingPage} from '@/features/onboarding/components/OnboardingPage';
import {OnboardingPato} from '@/features/onboarding/components/OnboardingPato';
import {useOnboarding} from '@/features/onboarding/store/OnboardingProvider';
import {colors,radius,spacing,typography} from '@/constants/theme';

function normalizeUsername(value:string){
  return value.toLocaleLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,24);
}

export default function Username(){
  const {session}=useAuth();
  const {height}=useWindowDimensions();
  const {profile,hydrated,updateProfile}=useOnboarding();
  const suggestedUsername=DEMO_MODE?normalizeUsername(profile.displayName.normalize('NFD').replace(/[\u0300-\u036f]/g,'')):'';
  const [username,setUsername]=useState(profile.username||suggestedUsername);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);

  useEffect(()=>{if(hydrated)setUsername(profile.username||suggestedUsername);},[hydrated,profile.username,suggestedUsername]);

  const continueFlow=async()=>{
    if(busy)return;
    const clean=normalizeUsername(username);
    if(clean.length<3){setError('Elegí un username de al menos 3 caracteres.');return;}
    updateProfile({username:clean});
    if(DEMO_MODE){router.push('/onboarding/app-lock');return;}
    if(!session){router.push('/auth?signup=true');return;}
    setBusy(true);try{await profileService.updateProfile({displayName:profile.displayName,username:clean,notificationsEnabled:profile.notificationsEnabled});await markOnboardingCompleted();router.replace('/(tabs)');}catch(cause){setError(userMessage(cause));}finally{setBusy(false);}
  };

  return (
    <OnboardingPage step={8} actions={<PrimaryButton disabled={!hydrated||busy} title="Continuar" onPress={continueFlow}/>}>
      <OnboardingPato variant="avatar" size={height<700?106:138}/>
      <OnboardingCopy title="Elegí tu nombre en Pato Pay." body="Lo van a usar para encontrarte. No es la dirección de tu wallet."/>
      <View style={styles.inputWrap}>
        <Text style={styles.at}>@</Text>
        <TextInput
          autoFocus={!DEMO_MODE}
          autoCapitalize="none"
          value={username}
          onChangeText={value=>{setUsername(normalizeUsername(value));setError(null);}}
          onSubmitEditing={continueFlow}
          placeholder="tunombre"
          placeholderTextColor={colors.muted}
          selectionColor={colors.yellow}
          returnKeyType="next"
          style={styles.input}
        />
      </View>
      {error&&<Text style={styles.error}>{error}</Text>}
    </OnboardingPage>
  );
}

const styles=StyleSheet.create({
  inputWrap:{width:'100%',height:58,marginTop:spacing.xl,paddingHorizontal:spacing.md,flexDirection:'row',alignItems:'center',borderRadius:radius.md,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},
  at:{...typography.h3,color:colors.yellow},
  input:{...typography.body,flex:1,height:'100%',color:colors.text,paddingLeft:spacing.xs},
  error:{...typography.caption,color:colors.danger,marginTop:spacing.xs,alignSelf:'flex-start',fontWeight:'400'},
});
