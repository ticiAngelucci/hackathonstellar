import {useEffect,useState} from 'react';
import {ActivityIndicator,StyleSheet,Text,View} from 'react-native';
import Animated,{FadeInDown} from 'react-native-reanimated';
import {Screen} from '@/components/Screen';
import {AppHeader} from '@/components/AppHeader';
import {PatoAgent} from '@/components/PatoAgent';
import {ServiceRow} from '@/components/ServiceRow';
import {serviceCatalog} from '@/constants/serviceCatalog';
import {subscriptionService} from '@/services/appDataService';
import {colors,radius,spacing,typography} from '@/constants/theme';

export default function Services(){
  const [items,setItems]=useState(serviceCatalog);
  const [loading,setLoading]=useState(true);
  const [savingId,setSavingId]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);

  useEffect(()=>{
    let active=true;
    subscriptionService.list()
      .then(states=>{
        if(!active)return;
        setItems(serviceCatalog.map(service=>({...service,enabled:states.get(service.id)??false})));
        setError(null);
      })
      .catch(nextError=>{
        if(active)setError(nextError instanceof Error?nextError.message:'No pudimos cargar los servicios.');
      })
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[]);

  const toggle=async(id:string)=>{
    const service=items.find(item=>item.id===id);
    if(!service||savingId)return;
    setSavingId(id);
    setError(null);
    try{
      const enabled=await subscriptionService.set(id,!service.enabled);
      setItems(current=>current.map(item=>item.id===id?{...item,enabled}:item));
    }catch(nextError){
      setError(nextError instanceof Error?nextError.message:'No pudimos guardar el servicio.');
    }finally{
      setSavingId(null);
    }
  };

  return (
    <Screen>
      <AppHeader title="Servicios automáticos"/>
      <Animated.View entering={FadeInDown.duration(340)} style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.title}>Automatizá tus pagos</Text>
          <Text style={styles.sub}>Conectá tus servicios y Pato los paga automáticamente por vos.</Text>
        </View>
        <PatoAgent size={124}/>
      </Animated.View>

      {loading&&<View style={styles.status}><ActivityIndicator color={colors.yellow}/><Text style={styles.statusText}>Sincronizando con Supabase…</Text></View>}
      {!loading&&error&&<Animated.Text entering={FadeInDown.duration(220)} style={styles.error}>{error}</Animated.Text>}

      <View style={styles.list}>
        {items.map((service,index)=>(
          <Animated.View key={service.id} entering={FadeInDown.delay(index*55).duration(280)}>
            <ServiceRow
              service={service}
              last={index===items.length-1}
              disabled={loading||savingId!==null}
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
