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
  return value.toLocaleLowerCase().replace(/[^a-z0-9_.]/g,'').slice(0,24);
}

export default function Username(){
  const {height}=useWindowDimensions();
  const {profile,hydrated,updateProfile}=useOnboarding();
  const [username,setUsername]=useState(profile.username);
  const [error,setError]=useState<string|null>(null);

  useEffect(()=>{if(hydrated)setUsername(profile.username);},[hydrated,profile.username]);

  const continueFlow=()=>{
    const clean=normalizeUsername(username);
    if(clean.length<3){setError('Elegí un username de al menos 3 caracteres.');return;}
    updateProfile({username:clean});
    router.push('/onboarding/wallet');
  };

  return (
    <OnboardingPage step={8} actions={<PrimaryButton disabled={!hydrated} title="Continuar" onPress={continueFlow}/>}>
      <OnboardingPato variant="avatar" size={height<700?106:138}/>
      <OnboardingCopy title="Elegí tu nombre en Pato Pay." body="Lo van a usar para encontrarte. No es la dirección de tu wallet."/>
      <View style={styles.inputWrap}>
        <Text style={styles.at}>@</Text>
        <TextInput
          autoFocus
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
