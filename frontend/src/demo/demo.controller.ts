import AsyncStorage from '@react-native-async-storage/async-storage';
import {assertDemo,DEMO_PREFIX} from './demo.config';
import {initialDemoState} from './demo.data';
import type {DemoState} from './demo.types';
let state:DemoState|undefined;
let generation=0;
export const demoGeneration=()=>generation;
let queue:Promise<unknown>=Promise.resolve();
const listeners=new Set<()=>void>();
export function onDemoReset(listener:()=>void){listeners.add(listener);return ()=>{listeners.delete(listener);};}
function serial<T>(work:()=>Promise<T>):Promise<T>{const next=queue.then(work);queue=next.catch(()=>{});return next;}
async function load(){if(!state){const raw=await AsyncStorage.getItem(DEMO_PREFIX+'state');state=raw?JSON.parse(raw):initialDemoState();}return state!;}
export function readDemoState(){assertDemo();return serial(async()=>JSON.parse(JSON.stringify(await load())) as DemoState);}
export function mutateDemo<T>(change:(draft:DemoState)=>T){assertDemo();return serial(async()=>{const draft=JSON.parse(JSON.stringify(await load())) as DemoState;const result=change(draft);await AsyncStorage.setItem(DEMO_PREFIX+'state',JSON.stringify(draft));state=draft;return result;});}
export function resetDemoState(){assertDemo();return serial(async()=>{const keys=(await AsyncStorage.getAllKeys()).filter(key=>key.startsWith(DEMO_PREFIX));await AsyncStorage.multiRemove(keys);generation++;state=initialDemoState();listeners.forEach(listener=>listener());});}
