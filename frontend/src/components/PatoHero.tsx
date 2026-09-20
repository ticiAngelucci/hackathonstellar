import {Image,ImageStyle,StyleProp} from 'react-native';

export function PatoHero({size=280,style}:{size?:number;style?:StyleProp<ImageStyle>}){
  return (
    <Image
      source={require('../../assets/pato/pato-hero.png')}
      resizeMode="contain"
      style={[{width:size,height:size},style]}
    />
  );
}
