import {PropsWithChildren,useEffect,useRef,useState} from 'react';
import {AppState,StyleSheet,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Animated,{FadeInDown} from 'react-native-reanimated';
import {PatoAgent} from '@/components/PatoAgent';
import {PrimaryButton} from '@/components/PrimaryButton';
import {authenticate,isAppLockEnabled} from '@/services/security/local-auth.service';
import {colors,spacing,typography} from '@/constants/theme';

function errorMessage(error?:string){
  if(error==='user_cancel'||error==='app_cancel'||error==='system_cancel')return 'Desbloqueo cancelado.';
  if(error==='lockout')return 'Demasiados intentos. Usá la seguridad de tu dispositivo.';
  if(error==='not_enrolled'||error==='passcode_not_set')return 'Configurá biometría o bloqueo de pantalla en tu dispositivo.';
  return 'No pudimos verificar tu identidad. Intentá de nuevo.';
}

export function AppLockGate({children}:PropsWithChildren){
  const [checking,setChecking]=useState(true);
  const [locked,setLocked]=useState(false);
  const [authenticating,setAuthenticating]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const authenticatingRef=useRef(false);

  useEffect(()=>{
    let active=true;
    isAppLockEnabled()
      .then(enabled=>{if(active)setLocked(enabled);})
      .catch(()=>{if(active)setLocked(false);})
      .finally(()=>{if(active)setChecking(false);});

    const subscription=AppState.addEventListener('change',nextState=>{
      const leavingApp=nextState==='inactive'||nextState==='background';
      if(leavingApp&&!authenticatingRef.current){
        void isAppLockEnabled().then(enabled=>{if(enabled)setLocked(true);});
      }
    });

    return ()=>{
      active=false;
      subscription.remove();
    };
  },[]);

  const unlock=async()=>{
    if(authenticating)return;
    authenticatingRef.current=true;
    setAuthenticating(true);
    setError(null);
    try{
      const result=await authenticate('device');
      if(result.success)setLocked(false);
      else setError(errorMessage(result.error));
    }catch{
      setError('No pudimos abrir el desbloqueo del dispositivo.');
    }finally{
      authenticatingRef.current=false;
      setAuthenticating(false);
    }
  };

  if(checking){
    return <View style={styles.loading}/>;
  }

  if(!locked)return children;

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.View entering={FadeInDown.duration(360)} style={styles.content}>
        <PatoAgent size={190}/>
        <Text style={styles.title}>Pato Pay está protegido</Text>
        <Text style={styles.body}>Desbloqueá la aplicación con la seguridad de tu dispositivo.</Text>
        {error&&<Text style={styles.error}>{error}</Text>}
      </Animated.View>
      <PrimaryButton disabled={authenticating} icon="lock-open" title={authenticating?'Verificando…':'Desbloquear'} onPress={()=>void unlock()}/>
    </SafeAreaView>
  );
}

const styles=StyleSheet.create({
  loading:{flex:1,backgroundColor:colors.bg},
  safe:{flex:1,justifyContent:'space-between',paddingHorizontal:spacing.xl,paddingTop:spacing.xxl,paddingBottom:spacing.lg,backgroundColor:colors.bg},
  content:{flex:1,alignItems:'center',justifyContent:'center'},
  title:{...typography.h1,color:colors.text,textAlign:'center',marginTop:spacing.md},
  body:{...typography.body,color:colors.muted,textAlign:'center',maxWidth:320,marginTop:spacing.xs},
  error:{...typography.caption,color:colors.danger,textAlign:'center',marginTop:spacing.md,fontWeight:'400'},
});
