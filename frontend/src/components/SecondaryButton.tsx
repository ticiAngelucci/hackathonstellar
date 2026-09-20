import {Ionicons} from '@expo/vector-icons';
import {StyleProp,ViewStyle} from 'react-native';
import {PrimaryButton} from '@/components/PrimaryButton';

export function SecondaryButton({title,onPress,icon,style}:{
  title:string;
  onPress:()=>void;
  icon?:keyof typeof Ionicons.glyphMap;
  style?:StyleProp<ViewStyle>;
}){
  return <PrimaryButton title={title} onPress={onPress} icon={icon} variant="secondary" style={style}/>;
}
