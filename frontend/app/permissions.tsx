import {DEMO_MODE} from '@/demo/demo.config';
import {RealPermissions} from '@/components/RealPermissions';
import {usePolicy,useSavePolicy} from '@/hooks/usePolicy';
import {userMessage} from '@/lib/errors';
import {LoadingCards} from '@/components/LoadingCards';
import {useEffect,useState} from 'react';
import {Ionicons} from '@expo/vector-icons';
import {Pressable,StyleSheet,Switch,Text,View} from 'react-native';
import Animated,{FadeInDown} from 'react-native-reanimated';
import {Screen} from '@/components/Screen';
import {AppHeader} from '@/components/AppHeader';
import {PatoAgent} from '@/components/PatoAgent';
import {PrimaryButton} from '@/components/PrimaryButton';
import {defaultPaymentPolicy} from '@/services/appDataService';
import {colors,radius,spacing,typography} from '@/constants/theme';

function StepButton({icon,onPress,disabled=false}:{icon:'add'|'remove';onPress:()=>void;disabled?:boolean}){
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({pressed})=>[styles.stepButton,(pressed||disabled)&&styles.pressed]}>
      <Ionicons name={icon} size={17} color={colors.text}/>
    </Pressable>
  );
}

function RuleRow({icon,label,value,onChange,disabled=false,delay=0}:{
  icon:keyof typeof Ionicons.glyphMap;
  label:string;
  value:number;
  onChange:(value:number)=>void;
  disabled?:boolean;
  delay?:number;
}){
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(280)} style={styles.rule}>
      <View style={styles.ruleIcon}><Ionicons name={icon} size={19} color={colors.yellow}/></View>
      <Text style={styles.ruleLabel}>{label}</Text>
      <View style={styles.stepper}>
        <StepButton disabled={disabled} icon="remove" onPress={()=>onChange(Math.max(0,value-5))}/>
        <Text style={styles.value}>{value} <Text style={styles.asset}>USDC</Text></Text>
        <StepButton disabled={disabled} icon="add" onPress={()=>onChange(value+5)}/>
      </View>
    </Animated.View>
  );
}

export default DEMO_MODE?Permissions:RealPermissions;
function Permissions(){
  const [autoPay,setAutoPay]=useState(defaultPaymentPolicy.autoPayLimit);
  const [approval,setApproval]=useState(defaultPaymentPolicy.approvalLimit);
  const [blocked,setBlocked]=useState(defaultPaymentPolicy.blockAbove);
  const [daily,setDaily]=useState(defaultPaymentPolicy.dailyLimit);
  const [allowedOnly,setAllowedOnly]=useState(defaultPaymentPolicy.allowedRecipientsOnly);
  const query=usePolicy();const mutation=useSavePolicy();
  const loading=query.isLoading;
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [saved,setSaved]=useState(false);

  useEffect(()=>{
    const policy=query.data;if(!policy)return;
    setAutoPay(policy.autoPayLimit);setApproval(policy.approvalLimit);setBlocked(policy.blockAbove);setDaily(policy.dailyLimit);setAllowedOnly(policy.allowedRecipientsOnly);
  },[query.data]);

  const save=async()=>{
    setSaving(true);
    setSaved(false);
    setError(null);
    try{
      await mutation.mutateAsync({
        version:query.data?.version,
        autoPayLimit:autoPay,
        approvalLimit:approval,
        blockAbove:blocked,
        dailyLimit:daily,
        allowedRecipientsOnly:allowedOnly,
      });
      setSaved(true);
    }catch(nextError){
      setError(userMessage(nextError,'No pudimos guardar las reglas.'));
    }finally{
      setSaving(false);
    }
  };

  return (
    <Screen>
      <AppHeader title="Permisos de pago"/>
      <Animated.View entering={FadeInDown.duration(340)} style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>REGLAS DEL AGENTE</Text>
          <Text style={styles.title}>Vos ponés las reglas.</Text>
          <Text style={styles.sub}>{query.data?.notice?'Vos decidís cómo puede actuar Pato.':'Pato las ejecuta.'}</Text>
        </View>
        <PatoAgent size={128}/>
      </Animated.View>

      {loading&&<LoadingCards/>}
      {query.data?.notice&&<Text style={styles.statusText}>{query.data.notice}</Text>}
      {query.error&&<><Text style={styles.error}>{userMessage(query.error,'No pudimos cargar tus reglas.')}</Text><PrimaryButton title="Reintentar" onPress={()=>void query.refetch()}/></>}
      {!loading&&error&&<Animated.Text entering={FadeInDown.duration(220)} style={styles.error}>{error}</Animated.Text>}
      {saved&&<Animated.Text entering={FadeInDown.duration(220)} style={styles.saved}>Tus reglas quedaron guardadas.</Animated.Text>}

      <View style={styles.rules}>
        <RuleRow disabled={loading||saving||!query.data||query.data.editable===false} delay={80} icon="flash" label="Autopagar hasta" value={autoPay} onChange={setAutoPay}/>
        <RuleRow disabled={loading||saving||!query.data||query.data.editable===false} delay={130} icon="checkmark-circle" label="Pedir aprobación hasta" value={approval} onChange={value=>{setApproval(value);if(query.data?.blockFollowsApproval)setBlocked(value);}}/>
        <RuleRow disabled={loading||saving||!query.data||query.data.editable===false||query.data.blockFollowsApproval} delay={180} icon="shield" label="Bloquear más de" value={blocked} onChange={setBlocked}/>
        <RuleRow disabled={loading||saving||!query.data||query.data.editable===false} delay={230} icon="speedometer" label="Límite diario total" value={daily} onChange={setDaily}/>
        <Animated.View entering={FadeInDown.delay(280).duration(280)} style={styles.rule}>
          <View style={styles.ruleIcon}><Ionicons name="people" size={19} color={colors.yellow}/></View>
          <View style={styles.recipientCopy}>
            <Text style={styles.ruleLabel}>Destinatarios permitidos</Text>
            <Text style={styles.ruleHint}>Solo contactos aprobados</Text>
          </View>
          <Switch
            value={allowedOnly}
            disabled={loading||saving||!query.data||query.data.editable===false}
            onValueChange={setAllowedOnly}
            trackColor={{false:colors.border,true:colors.yellow}}
            thumbColor={allowedOnly?colors.black:colors.muted}
          />
        </Animated.View>
      </View>

      <PrimaryButton disabled={loading||saving||!query.data||query.data.editable===false} title={saving?'Guardando…':'Guardar cambios'} onPress={()=>void save()} style={styles.cta}/>
    </Screen>
  );
}

const styles=StyleSheet.create({
  hero:{minHeight:146,flexDirection:'row',alignItems:'center',marginBottom:spacing.lg,borderRadius:radius.lg,paddingLeft:spacing.lg,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,overflow:'hidden'},
  heroCopy:{flex:1,zIndex:1},
  eyebrow:{...typography.caption,color:colors.muted,fontSize:10,letterSpacing:1.1,marginBottom:spacing.xs},
  title:{...typography.h2,color:colors.text},
  sub:{...typography.bodyStrong,color:colors.yellow,marginTop:spacing.xxs},
  rules:{gap:spacing.xs},
  status:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:spacing.xs,marginBottom:spacing.sm},
  statusText:{...typography.caption,color:colors.muted,fontWeight:'400'},
  error:{...typography.caption,color:colors.danger,textAlign:'center',marginBottom:spacing.sm,fontWeight:'400'},
  saved:{...typography.caption,color:colors.success,textAlign:'center',marginBottom:spacing.sm,fontWeight:'700'},
  rule:{minHeight:66,flexDirection:'row',alignItems:'center',gap:spacing.sm,padding:spacing.sm,borderRadius:radius.md,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},
  ruleIcon:{width:38,height:38,borderRadius:radius.sm,alignItems:'center',justifyContent:'center',backgroundColor:colors.bgSoft},
  ruleLabel:{...typography.bodyStrong,color:colors.text,flex:1},
  ruleHint:{...typography.caption,color:colors.muted,marginTop:1},
  recipientCopy:{flex:1},
  stepper:{flexDirection:'row',alignItems:'center',gap:spacing.xs},
  stepButton:{width:28,height:28,borderRadius:radius.pill,alignItems:'center',justifyContent:'center',backgroundColor:colors.bgSoft,borderWidth:1,borderColor:colors.border},
  pressed:{opacity:.68},
  value:{...typography.bodyStrong,color:colors.text,minWidth:72,textAlign:'center'},
  asset:{...typography.caption,color:colors.muted,fontSize:9},
  cta:{marginTop:spacing.lg},
});
