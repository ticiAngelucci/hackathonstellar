import {Image,ImageSourcePropType,StyleSheet} from 'react-native';
import Animated,{FadeInDown} from 'react-native-reanimated';

const sources={
  hero:require('../../../../assets/pato/pato-hero.png'),
  agent:require('../../../../assets/pato/pato-agent.png'),
  avatar:require('../../../../assets/pato/pato-avatar.png'),
  approval:require('../../../../assets/pato/pato-approval.png'),
  success:require('../../../../assets/pato/pato-success.png'),
} satisfies Record<string,ImageSourcePropType>;

export function OnboardingPato({variant='hero',size=190}:{variant?:keyof typeof sources;size?:number}){
  return (
    <Animated.View entering={FadeInDown.springify().damping(15).stiffness(120)}>
      <Image source={sources[variant]} resizeMode="contain" style={[styles.image,{width:size,height:size}]}/>
    </Animated.View>
  );
}

const styles=StyleSheet.create({image:{alignSelf:'center'}});
