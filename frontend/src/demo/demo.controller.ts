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
function record(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function normalizeDemoState(value:unknown):DemoState{
 const defaults=initialDemoState();
 if(!record(value))return defaults;
 const candidate=value as Partial<DemoState>;
 return {
  ...defaults,
  balance:typeof candidate.balance==='number'&&Number.isFinite(candidate.balance)?candidate.balance:defaults.balance,
  wallet:candidate.wallet??defaults.wallet,
  groups:Array.isArray(candidate.groups)?candidate.groups:defaults.groups,
  transactions:Array.isArray(candidate.transactions)?candidate.transactions:defaults.transactions,
  requests:Array.isArray(candidate.requests)?candidate.requests:defaults.requests,
  subscriptions:record(candidate.subscriptions)?candidate.subscriptions as Record<string,boolean>:defaults.subscriptions,
  policy:record(candidate.policy)?{...defaults.policy,...candidate.policy}:defaults.policy,
  staking:typeof candidate.staking==='boolean'?candidate.staking:defaults.staking,
  sequence:typeof candidate.sequence==='number'&&Number.isFinite(candidate.sequence)?candidate.sequence:defaults.sequence,
  spent:typeof candidate.spent==='number'&&Number.isFinite(candidate.spent)?candidate.spent:defaults.spent,
 };
}
async function load(){
 if(!state){
  const raw=await AsyncStorage.getItem(DEMO_PREFIX+'state');
  try{state=normalizeDemoState(raw?JSON.parse(raw):null);}catch{state=initialDemoState();}
 }
 return state;
}
export function readDemoState(){assertDemo();return serial(async()=>JSON.parse(JSON.stringify(await load())) as DemoState);}
export function mutateDemo<T>(change:(draft:DemoState)=>T){assertDemo();return serial(async()=>{const draft=JSON.parse(JSON.stringify(await load())) as DemoState;const result=change(draft);await AsyncStorage.setItem(DEMO_PREFIX+'state',JSON.stringify(draft));state=draft;return result;});}
export function resetDemoState(){assertDemo();return serial(async()=>{const keys=(await AsyncStorage.getAllKeys()).filter(key=>key.startsWith(DEMO_PREFIX));await AsyncStorage.multiRemove(keys);generation++;state=initialDemoState();listeners.forEach(listener=>listener());});}
