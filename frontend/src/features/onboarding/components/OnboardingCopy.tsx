import {PropsWithChildren} from 'react';
import {StyleSheet,Text,View} from 'react-native';
import {colors,spacing,typography} from '@/constants/theme';

export function OnboardingCopy({title,body,children}:{title:string;body?:string;children?:PropsWithChildren['children']}){
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {body&&<Text style={styles.body}>{body}</Text>}
      {children}
    </View>
  );
}

const styles=StyleSheet.create({
  wrap:{alignItems:'center',width:'100%'},
  title:{...typography.h1,color:colors.text,textAlign:'center'},
  body:{...typography.body,color:colors.muted,textAlign:'center',marginTop:spacing.xs,maxWidth:330},
});
