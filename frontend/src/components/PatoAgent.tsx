import {Image,ImageStyle,StyleProp} from 'react-native';

export function PatoAgent({size=150,style}:{size?:number;style?:StyleProp<ImageStyle>}){
  return (
    <Image
      source={require('../../assets/pato/pato-agent.png')}
      resizeMode="contain"
      style={[{width:size,height:size},style]}
    />
  );
}
