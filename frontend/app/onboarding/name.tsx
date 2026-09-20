import {useEffect,useState} from 'react';
import {router} from 'expo-router';
import {StyleSheet,Text,TextInput,useWindowDimensions} from 'react-native';
import {PrimaryButton} from '@/components/PrimaryButton';
import {OnboardingCopy} from '@/features/onboarding/components/OnboardingCopy';
import {OnboardingPage} from '@/features/onboarding/components/OnboardingPage';
import {OnboardingPato} from '@/features/onboarding/components/OnboardingPato';
import {useOnboarding} from '@/features/onboarding/store/OnboardingProvider';
import {colors,radius,spacing,typography} from '@/constants/theme';

export default function Name(){
  const {height}=useWindowDimensions();
  const {profile,hydrated,updateProfile}=useOnboarding();
  const [name,setName]=useState(profile.displayName);
  const [error,setError]=useState<string|null>(null);

  useEffect(()=>{if(hydrated)setName(profile.displayName);},[hydrated,profile.displayName]);

  const continueFlow=()=>{
    const clean=name.trim();
    if(clean.length<2){setError('Escribí al menos 2 caracteres.');return;}
    updateProfile({displayName:clean});
    router.push('/onboarding/username');
  };

  return (
    <OnboardingPage step={7} actions={<PrimaryButton disabled={!hydrated} title="Continuar" onPress={continueFlow}/>}>
      <OnboardingPato variant="avatar" size={height<700?112:145}/>
      <OnboardingCopy title="¿Cómo querés que te llame?" body="Así voy a saludarte dentro de Pato Pay."/>
      <TextInput
        autoFocus
        value={name}
        onChangeText={value=>{setName(value);setError(null);}}
        onSubmitEditing={continueFlow}
        placeholder="Tu nombre"
        placeholderTextColor={colors.muted}
        selectionColor={colors.yellow}
        maxLength={40}
        returnKeyType="next"
        style={styles.input}
      />
      {error&&<Text style={styles.error}>{error}</Text>}
    </OnboardingPage>
  );
}

const styles=StyleSheet.create({
  input:{width:'100%',height:58,marginTop:spacing.xl,paddingHorizontal:spacing.md,borderRadius:radius.md,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,color:colors.text,...typography.body},
  error:{...typography.caption,color:colors.danger,marginTop:spacing.xs,alignSelf:'flex-start',fontWeight:'400'},
});
