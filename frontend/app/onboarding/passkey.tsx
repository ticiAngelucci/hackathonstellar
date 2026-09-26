import {userMessage} from '@/lib/errors';
import {DEMO_MODE} from '@/demo/demo.config';
import {useEffect,useRef,useState} from 'react';
import {router,useLocalSearchParams} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {Pressable,StyleSheet,Text,View,useWindowDimensions} from 'react-native';
import Animated,{FadeInDown} from 'react-native-reanimated';
import {PrimaryButton} from '@/components/PrimaryButton';
import {OnboardingCopy} from '@/features/onboarding/components/OnboardingCopy';
import {OnboardingPage} from '@/features/onboarding/components/OnboardingPage';
import {OnboardingPato} from '@/features/onboarding/components/OnboardingPato';
import {useOnboarding} from '@/features/onboarding/store/OnboardingProvider';
import {walletMode,walletService,type WalletAccount} from '@/services/wallet';
import {colors,radius,spacing,typography} from '@/constants/theme';

export default function Passkey(){
  const {height}=useWindowDimensions();
  const {profile,updateProfile}=useOnboarding();
  const [creating,setCreating]=useState(false);
  const [showHow,setShowHow]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [account,setAccount]=useState<WalletAccount|null>(null);

  const create=async()=>{
    if(creating)return;
    setCreating(true);
    setError(null);
    try{
      const wallet=await walletService.createWithPasskey({displayName:profile.displayName,username:profile.username});
      updateProfile({
        walletAddress:wallet.walletAddress,
        walletNetwork:wallet.network,
        walletStatus:wallet.status,
        walletCredentialId:wallet.credentialId,
        walletCreationTxHash:wallet.creationTxHash,
        walletCreated:true,
        passkeyCreated:wallet.signer==='passkey',
      });
      setAccount(wallet);
      setCreating(false);
    }catch(nextError){
      setError(userMessage(nextError,'No pudimos proteger tu wallet.'));
      setCreating(false);
    }
  };

  const {create:autocreate}=useLocalSearchParams<{create?:string}>();
  const started=useRef(false);
  useEffect(()=>{if(DEMO_MODE&&autocreate==='true'&&!started.current){started.current=true;void create();}},[autocreate]);

  const actions=account
    ?<PrimaryButton title="Continuar" onPress={()=>router.push(DEMO_MODE?'/onboarding/complete':'/onboarding/policy')}/>
    :<PrimaryButton disabled={creating} title={creating?'Preparando tu wallet...':'Crear wallet'} onPress={()=>void create()}/>;

  return (
    <OnboardingPage step={10} actions={actions}>
      <OnboardingPato variant={account?'success':'agent'} size={height<700?120:155}/>
      <OnboardingCopy
        title={DEMO_MODE?(account?'Wallet creada ✓':'Preparando tu wallet...'):account?(account.status==='active'?'Tu wallet está lista.':'Modo demo listo.'):'Protegé tu wallet.'}
        body={DEMO_MODE?'Tu wallet está lista para acompañarte.':account
          ?account.status==='active'
            ?'La smart wallet quedó confirmada en Stellar Testnet.'
            :'No se creó una wallet ni una passkey real. Cambiá a modo Stellar para probar blockchain.'
          :'Tu passkey autoriza operaciones blockchain. Es distinta del bloqueo para abrir Pato Pay.'}
      />
      {account&&(
        <View style={styles.addressCard}>
          <Text style={styles.addressLabel}>{DEMO_MODE?'TU WALLET':account.status==='active'?'STELLAR TESTNET':'MODO MOCK'}</Text>
          <Text selectable numberOfLines={1} style={styles.address}>{DEMO_MODE?'Lista para usar':`${account.walletAddress.slice(0,10)}…${account.walletAddress.slice(-8)}`}</Text>
          {account.creationTxHash&&<Text numberOfLines={1} style={styles.tx}>tx {account.creationTxHash.slice(0,12)}…{account.creationTxHash.slice(-8)}</Text>}
        </View>
      )}
      {!account&&!DEMO_MODE&&<>
      <View style={styles.device}>
        <View style={styles.icon}><Ionicons name="finger-print" size={34} color={colors.yellow}/></View>
        <View style={styles.deviceCopy}><Text style={styles.deviceTitle}>Tu dispositivo crea la llave</Text><Text style={styles.deviceText}>{walletMode==='stellar'?'La clave privada queda dentro del gestor de passkeys del sistema.':'Estás en modo mock: este paso no crea una credencial real.'}</Text></View>
      </View>
      <Pressable onPress={()=>setShowHow(value=>!value)} style={({pressed})=>pressed&&styles.pressed}>
        <Text style={styles.how}>¿Cómo funciona? <Ionicons name={showHow?'chevron-up':'chevron-down'} size={12}/></Text>
      </Pressable>
      {showHow&&<Animated.Text entering={FadeInDown.duration(220)} style={styles.explanation}>Tu dispositivo crea una credencial única. Pato Pay solo recibe la autorización necesaria y nunca una clave que pueda usar por su cuenta.</Animated.Text>}
      </>}
      {error&&<Text style={styles.error}>{error}</Text>}
    </OnboardingPage>
  );
}

const styles=StyleSheet.create({
  device:{width:'100%',marginTop:spacing.lg,padding:spacing.md,flexDirection:'row',alignItems:'center',gap:spacing.sm,borderRadius:radius.lg,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},
  icon:{width:54,height:54,borderRadius:radius.md,alignItems:'center',justifyContent:'center',backgroundColor:colors.bgSoft},
  deviceCopy:{flex:1},
  deviceTitle:{...typography.bodyStrong,color:colors.text},
  deviceText:{...typography.caption,color:colors.muted,marginTop:2,fontWeight:'400'},
  how:{...typography.caption,color:colors.blueBright,marginTop:spacing.md},
  explanation:{...typography.caption,color:colors.muted,textAlign:'center',marginTop:spacing.xs,maxWidth:330,fontWeight:'400'},
  addressCard:{width:'100%',marginTop:spacing.lg,padding:spacing.md,borderRadius:radius.lg,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,alignItems:'center'},
  addressLabel:{fontSize:9,lineHeight:12,color:colors.success,fontWeight:'900',letterSpacing:1},
  address:{...typography.bodyStrong,color:colors.text,marginTop:spacing.xs},
  tx:{...typography.caption,color:colors.blueBright,marginTop:spacing.xxs,fontWeight:'400'},
  error:{...typography.caption,color:colors.danger,textAlign:'center',marginTop:spacing.sm,fontWeight:'400'},
  pressed:{opacity:.65},
});
