import {useGroups,useCreateGroup} from '@/hooks/useGroups';
import {userMessage} from '@/lib/errors';
import {LoadingCards} from '@/components/LoadingCards';
import {DEMO_MODE} from '@/demo/demo.config';
import {useMemo,useState} from 'react';
import {Ionicons} from '@expo/vector-icons';
import {KeyboardAvoidingView,Modal,Platform,Pressable,StyleSheet,Text,TextInput,View} from 'react-native';
import Animated,{FadeInDown} from 'react-native-reanimated';
import {Screen} from '@/components/Screen';
import {GroupCard} from '@/components/GroupCard';
import {PrimaryButton} from '@/components/PrimaryButton';
import {PatoPayEvent} from '@/services/eventService';
import {Group} from '@/types';
import {colors,radius,spacing,typography} from '@/constants/theme';

const imageKeys=['asado','bariloche','casa','gym'] as const;

function eventToGroup(event:PatoPayEvent,index:number):Group{
  return {
    id:event.id,
    name:event.name,
    members:event.participants.length,
    membersVisible:event.membersVisible,
    balance:event.balance??0,
    stakingApy:0,
    imageKey:imageKeys[index%imageKeys.length],
  };
}

export default function Groups(){
  const [query,setQuery]=useState('');
  const groups=useGroups();const create=useCreateGroup();
  const remoteGroups=useMemo(()=>(groups.data??[]).map(eventToGroup),[groups.data]);
  const loading=groups.isLoading;
  const apiError=groups.error?userMessage(groups.error,'No pudimos cargar tus grupos.'):null;
  const refresh=groups.refetch;
  const [modalVisible,setModalVisible]=useState(false);
  const [groupName,setGroupName]=useState('');
  const [creating,setCreating]=useState(false);
  const [createError,setCreateError]=useState<string|null>(null);

  const visibleGroups=useMemo(()=>{
    const normalized=query.trim().toLocaleLowerCase();
    return normalized?remoteGroups.filter(group=>group.name.toLocaleLowerCase().includes(normalized)):remoteGroups;
  },[query,remoteGroups]);

  const closeModal=()=>{
    if(creating)return;
    setModalVisible(false);
    setGroupName('');
    setCreateError(null);
  };

  const createGroup=async()=>{
    const name=groupName.trim();
    if(!name){
      setCreateError('Escribí un nombre para el grupo.');
      return;
    }

    setCreating(true);
    setCreateError(null);
    try{
      await create.mutateAsync(name);
      setGroupName('');
      setModalVisible(false);
    }catch(error){
      setCreateError(userMessage(error,'No pudimos crear el grupo.'));
    }finally{
      setCreating(false);
    }
  };

  return (
    <>
      <Screen contentStyle={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.title}>Mis grupos</Text>
          <Pressable accessibilityLabel="Crear grupo" onPress={()=>setModalVisible(true)} style={({pressed})=>[styles.add,pressed&&styles.pressed]}>
            <Ionicons name="add" size={25} color={colors.text}/>
          </Pressable>
        </View>

        <View style={styles.search}>
          <Ionicons name="search" size={17} color={colors.muted}/>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar grupo..."
            placeholderTextColor={colors.muted}
            selectionColor={colors.yellow}
            style={styles.input}
            returnKeyType="search"
          />
          {query.length>0&&(
            <Pressable accessibilityLabel="Limpiar búsqueda" onPress={()=>setQuery('')}>
              <Ionicons name="close-circle" size={17} color={colors.muted}/>
            </Pressable>
          )}
        </View>

        {apiError&&(
          <Animated.View entering={FadeInDown.duration(240)} style={styles.connectionError}>
            <Ionicons name="cloud-offline-outline" size={16} color={colors.danger}/>
            <Text numberOfLines={2} style={styles.connectionText}>{apiError}</Text>
            <Pressable onPress={()=>void refresh()} style={({pressed})=>pressed&&styles.pressed}>
              <Text style={styles.retry}>Reintentar</Text>
            </Pressable>
          </Animated.View>
        )}

        <View style={styles.list}>
          {loading&&<LoadingCards/>}
          {visibleGroups.map((group,index)=><GroupCard key={group.id} group={group} index={index}/>) }
          {!loading&&!apiError&&visibleGroups.length===0&&(
            <Animated.View entering={FadeInDown.duration(280)} style={styles.emptyState}>
              <View style={styles.emptyIcon}><Ionicons name="people-outline" size={24} color={colors.yellow}/></View>
              <Text style={styles.emptyTitle}>{query?'No encontramos ese grupo':'Parece que todavía no tenés grupos.'}</Text>
              <PrimaryButton title="Crear grupo" onPress={()=>setModalVisible(true)}/>
              <Text style={styles.empty}>{query?'Probá con otro nombre.':'Creá tu primer grupo para compartir gastos.'}</Text>
            </Animated.View>
          )}
        </View>
      </Screen>

      <Modal transparent animationType="fade" visible={modalVisible} onRequestClose={closeModal}>
        <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={styles.modalRoot}>
          <Pressable accessibilityLabel="Cerrar" style={styles.backdrop} onPress={closeModal}/>
          <Animated.View entering={FadeInDown.springify().damping(18).stiffness(190)} style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Nuevo grupo</Text>
                <Text style={styles.modalSubtitle}>{DEMO_MODE?'Organizá un nuevo fondo común.':'Se guardará directamente en Supabase.'}</Text>
              </View>
              <Pressable accessibilityLabel="Cerrar" onPress={closeModal} style={styles.closeButton}>
                <Ionicons name="close" size={21} color={colors.text}/>
              </Pressable>
            </View>
            <TextInput
              autoFocus
              value={groupName}
              onChangeText={value=>{setGroupName(value);setCreateError(null);}}
              onSubmitEditing={()=>void createGroup()}
              placeholder="Nombre del grupo"
              placeholderTextColor={colors.muted}
              selectionColor={colors.yellow}
              returnKeyType="done"
              maxLength={100}
              style={styles.groupInput}
            />
            {createError&&<Text style={styles.createError}>{createError}</Text>}
            <PrimaryButton
              title={creating?'Creando...':'Crear grupo'}
              icon="add"
              disabled={creating}
              onPress={()=>void createGroup()}
              style={styles.createButton}
            />
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles=StyleSheet.create({
  screen:{paddingTop:spacing.md},
  header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  title:{...typography.h2,color:colors.text},
  add:{width:42,height:42,borderRadius:radius.pill,backgroundColor:colors.blue,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:colors.blueBright},
  pressed:{opacity:.75,transform:[{scale:.96}]},
  search:{height:46,flexDirection:'row',alignItems:'center',gap:spacing.xs,marginTop:spacing.md,paddingHorizontal:spacing.sm,borderRadius:radius.sm,backgroundColor:colors.bgSoft,borderWidth:1,borderColor:colors.border},
  input:{...typography.small,flex:1,color:colors.text,paddingVertical:0},
  connectionError:{flexDirection:'row',alignItems:'center',gap:spacing.xs,marginTop:spacing.xs,paddingHorizontal:spacing.sm,paddingVertical:spacing.xs,borderRadius:radius.sm,backgroundColor:'rgba(255,95,115,.08)',borderWidth:1,borderColor:'rgba(255,95,115,.22)'},
  connectionText:{fontSize:10,lineHeight:14,color:colors.muted,flex:1},
  retry:{...typography.caption,color:colors.yellow,fontSize:10},
  list:{gap:spacing.xs,marginTop:spacing.sm},
  loading:{minHeight:150,alignItems:'center',justifyContent:'center',gap:spacing.sm},
  loadingText:{...typography.small,color:colors.muted},
  emptyState:{alignItems:'center',paddingVertical:spacing.xxl,paddingHorizontal:spacing.lg},
  emptyIcon:{width:48,height:48,borderRadius:radius.pill,alignItems:'center',justifyContent:'center',backgroundColor:colors.bgSoft,borderWidth:1,borderColor:colors.border},
  emptyTitle:{...typography.bodyStrong,color:colors.text,marginTop:spacing.sm},
  empty:{...typography.small,color:colors.muted,textAlign:'center',marginTop:spacing.xxs},
  modalRoot:{flex:1,justifyContent:'center',padding:spacing.lg},
  backdrop:{position:'absolute',top:0,right:0,bottom:0,left:0,backgroundColor:'rgba(2,7,14,.78)'},
  modalCard:{padding:spacing.lg,borderRadius:radius.lg,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},
  modalHeader:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:spacing.sm},
  modalTitle:{...typography.h2,color:colors.text},
  modalSubtitle:{...typography.caption,color:colors.muted,marginTop:2,fontWeight:'400'},
  closeButton:{width:36,height:36,borderRadius:radius.pill,alignItems:'center',justifyContent:'center',backgroundColor:colors.bgSoft},
  groupInput:{height:52,marginTop:spacing.lg,paddingHorizontal:spacing.md,borderRadius:radius.md,color:colors.text,backgroundColor:colors.bgSoft,borderWidth:1,borderColor:colors.border,...typography.body},
  createError:{...typography.caption,color:colors.danger,marginTop:spacing.xs,fontWeight:'400'},
  createButton:{marginTop:spacing.md},
});
