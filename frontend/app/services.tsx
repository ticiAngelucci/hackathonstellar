import {DEMO_MODE} from '@/demo/demo.config';
import {useAutomaticServices,useSetAutomaticService} from '@/hooks/useAutomaticServices';
import {userMessage} from '@/lib/errors';
import {LoadingCards} from '@/components/LoadingCards';
import {PrimaryButton} from '@/components/PrimaryButton';
import {StyleSheet,Text,View} from 'react-native';
import Animated,{FadeInDown} from 'react-native-reanimated';
import {Screen} from '@/components/Screen';
import {AppHeader} from '@/components/AppHeader';
import {PatoAgent} from '@/components/PatoAgent';
import {ServiceRow} from '@/components/ServiceRow';
import {serviceCatalog} from '@/constants/serviceCatalog';
import {colors,radius,spacing,typography} from '@/constants/theme';

export default function Services(){
  const query=useAutomaticServices();const mutation=useSetAutomaticService();
  const items=serviceCatalog.map(service=>({...service,amount:DEMO_MODE?service.amount:undefined,enabled:query.data?.get(service.id)??false}));
  const loading=query.isLoading;const savingId=mutation.isPending?mutation.variables?.id:null;
  const error=query.error||mutation.error;
  const toggle=(id:string)=>{const service=items.find(s=>s.id===id);if(service&&!mutation.isPending)mutation.mutate({id,enabled:!service.enabled});};

  return (
    <Screen>
      <AppHeader title="Servicios automáticos"/>
      <Animated.View entering={FadeInDown.duration(340)} style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.title}>Automatizá tus pagos</Text>
          <Text style={styles.sub}>{DEMO_MODE?'Conectá tus servicios y Pato los paga automáticamente por vos.':'Guardá qué servicios querés automatizar. La ejecución de cobros estará disponible próximamente.'}</Text>
        </View>
        <PatoAgent size={124}/>
      </Animated.View>

      {loading&&<LoadingCards/>}
      {!!error&&<><Text style={styles.error}>{userMessage(error,'No pudimos actualizar tus servicios.')}</Text><PrimaryButton title="Reintentar" onPress={()=>void query.refetch()}/></>}

      <View style={styles.list}>
        {items.map((service,index)=>(
          <Animated.View key={service.id} entering={FadeInDown.delay(index*55).duration(280)}>
            <ServiceRow
              service={service}
              last={index===items.length-1}
              disabled={loading||savingId!==null||!query.data}
              onToggle={()=>void toggle(service.id)}
            />
          </Animated.View>
        ))}
      </View>
    </Screen>
  );
}

const styles=StyleSheet.create({
  hero:{
    minHeight:150,
    flexDirection:'row',
    alignItems:'center',
    paddingLeft:spacing.lg,
    borderRadius:radius.lg,
    overflow:'hidden',
    backgroundColor:colors.surface,
    borderWidth:1,
    borderColor:colors.border,
  },
  heroCopy:{flex:1,zIndex:1},
  title:{...typography.h2,color:colors.text},
  sub:{...typography.small,color:colors.muted,marginTop:spacing.xs},
  status:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:spacing.xs,marginTop:spacing.md},
  statusText:{...typography.caption,color:colors.muted,fontWeight:'400'},
  error:{...typography.caption,color:colors.danger,textAlign:'center',marginTop:spacing.md,fontWeight:'400'},
  list:{marginTop:spacing.lg,backgroundColor:colors.surface,borderRadius:radius.lg,overflow:'hidden',borderWidth:1,borderColor:colors.border},
});
