import {Text} from 'react-native';
import {useRealtimeUpdates} from '@/hooks/useRealtimeUpdates';
import {AuthBoundary} from '@/features/auth/AuthProvider';
import {useRouter} from 'expo-router';
import {TabList,TabSlot,TabTrigger,Tabs} from 'expo-router/ui';
import {TabBarMinimizeProvider,renderFadingTabScreen} from 'expo-glass-tabs';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {GlassTabBar,GlassTabButton,type GlassTabItem} from '@/components/GlassTabBar';
import {PatoAvatar} from '@/components/PatoAvatar';
import {colors} from '@/constants/theme';

type TabHref='/(tabs)'|'/(tabs)/groups'|'/(tabs)/pato'|'/(tabs)/activity'|'/(tabs)/profile';

const ITEMS:(GlassTabItem&{href:TabHref})[]=[
  {name:'index',href:'/(tabs)',label:'Inicio',icon:'house.fill'},
  {name:'groups',href:'/(tabs)/groups',label:'Grupos',icon:'person.2.fill'},
  {name:'pato',href:'/(tabs)/pato',label:'Pato',renderIcon:()=> <PatoAvatar size={30}/>},
  {name:'activity',href:'/(tabs)/activity',label:'Actividad',icon:'list.bullet'},
  {name:'profile',href:'/(tabs)/profile',label:'Perfil',icon:'person.fill'},
];

export default function Layout(){
  const router=useRouter();
  const realtime=useRealtimeUpdates();

  return (
    <AuthBoundary><GestureHandlerRootView style={{flex:1}}>
      {realtime.enabled&&!realtime.connected&&<Text style={{color:colors.muted,textAlign:'center',fontSize:11}}>Conectando actualizaciones en vivo…</Text>}
      <TabBarMinimizeProvider>
        <Tabs>
          <TabSlot renderFn={renderFadingTabScreen} style={{height:'100%'}}/>
          <TabList asChild>
            <GlassTabBar
              haptics
              onIndexSelected={index=>router.navigate(ITEMS[index].href)}
              theme={{
                activeTint:colors.yellow,
                inactiveTint:'rgba(248,250,255,0.58)',
                highlight:'rgba(255,255,255,0.22)',
                glassTint:'rgba(8,20,38,0.42)',
                solidFallback:'rgba(10,32,59,0.94)',
              }}
            >
              {ITEMS.map(({href,...item},index)=>(
                <TabTrigger key={item.name} asChild href={href} name={item.name}>
                  <GlassTabButton index={index} item={item}/>
                </TabTrigger>
              ))}
            </GlassTabBar>
          </TabList>
        </Tabs>
      </TabBarMinimizeProvider>
    </GestureHandlerRootView></AuthBoundary>
  );
}
