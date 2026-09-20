import {StyleSheet,Text} from 'react-native';
import Animated,{FadeInDown} from 'react-native-reanimated';
import {PatoSpeech} from '@/features/onboarding/components/PatoSpeech';
import {colors,spacing,typography} from '@/constants/theme';

export function WelcomeStep(){
  return (
    <>
      <Text style={styles.hello}>Hola 👋 Soy <Text style={styles.accent}>Pato.</Text></Text>
      <Animated.View entering={FadeInDown.delay(180).duration(340)} style={styles.speech}>
        <PatoSpeech delay={0}>Te voy a ayudar a pagar, ahorrar y organizar tu plata sin complicaciones.</PatoSpeech>
      </Animated.View>
    </>
  );
}

const styles=StyleSheet.create({
  hello:{...typography.h1,color:colors.text,textAlign:'center',marginBottom:spacing.lg},
  accent:{color:colors.yellow},
  speech:{width:'100%'},
});
