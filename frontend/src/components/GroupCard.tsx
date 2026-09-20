import {router} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {Image,StyleSheet,Text,View} from 'react-native';
import {AnimatedCard} from '@/components/AnimatedCard';
import {Group} from '@/types';
import {colors,radius,spacing,typography} from '@/constants/theme';
import {groupImages} from '@/constants/groupImages';

export function GroupCard({group,index=0}:{group:Group;index?:number}){
  const imageKey=group.imageKey??group.id;

  return (
    <AnimatedCard
      delay={index*55}
      style={styles.card}
      onPress={()=>router.push({
        pathname:'/group/[id]',
        params:{id:group.id,name:group.name,members:String(group.members),imageKey},
      })}
    >
      <Image source={groupImages[imageKey]??groupImages.asado} style={styles.thumbnail} resizeMode="cover"/>
      <View style={styles.copy}>
        <Text style={styles.name}>{group.name}</Text>
        <Text style={styles.meta}>{group.members} personas</Text>
      </View>
      <Ionicons name="chevron-forward" color={colors.blueBright} size={18}/>
    </AnimatedCard>
  );
}

const styles=StyleSheet.create({
  card:{minHeight:86,padding:7,flexDirection:'row',alignItems:'center',gap:spacing.sm,borderRadius:radius.md,backgroundColor:colors.bgSoft},
  thumbnail:{width:68,height:68,borderRadius:radius.sm,backgroundColor:colors.surface2},
  copy:{flex:1},
  name:{...typography.bodyStrong,color:colors.text,fontWeight:'800',fontSize:14},
  meta:{...typography.caption,color:colors.muted,marginTop:1,fontWeight:'400'},
});
