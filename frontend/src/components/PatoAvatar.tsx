import {Image,ImageStyle,StyleProp,StyleSheet,View} from 'react-native';
import {colors} from '@/constants/theme';

type PatoAvatarProps = {
  size?: number;
  style?: StyleProp<ImageStyle>;
};

export function PatoAvatar({size=54,style}:PatoAvatarProps){
  const imageSize=size*.9;

  return (
    <View
      style={[
        styles.frame,
        {width:size,height:size,borderRadius:size/2},
      ]}
    >
      <Image
        source={require('../../assets/pato/pato-avatar.png')}
        resizeMode="contain"
        style={[{width:imageSize,height:imageSize},style]}
      />
    </View>
  );
}

const styles=StyleSheet.create({
  frame:{
    alignItems:'center',
    justifyContent:'center',
    overflow:'hidden',
    backgroundColor:colors.bgSoft,
    borderWidth:1,
    borderColor:colors.border,
  },
});
