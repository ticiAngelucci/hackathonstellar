// Run the actual TypeScript services with isolated storage and a virtual clock.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
function environment(demo=true){
 const storage=new Map([['patopay:onboarding:profile:v1','REAL PROFILE'],['patopay:security:app-lock-enabled:v1','true']]);
 const cache=new Map();const delays=[];
 const adapter={async getItem(k){return storage.get(k)??null;},async setItem(k,v){storage.set(k,v);},async getAllKeys(){return [...storage.keys()];},async multiRemove(keys){keys.forEach(k=>storage.delete(k));},async removeItem(k){storage.delete(k);}};
 function load(file){
  file=path.resolve(root,file);if(!file.endsWith('.ts'))file+='.ts';if(cache.has(file))return cache.get(file).exports;
  const module={exports:{}};cache.set(file,module);
  const requireLocal=id=>{
   if(!demo&&id==='react-native-url-polyfill/auto')return {};
   if(!demo&&id==='@supabase/supabase-js')return {createClient(){throw Error('Real client unexpectedly initialized in isolated tests');}};
   if(id==='@react-native-async-storage/async-storage')return adapter;
   if(id==='expo-local-authentication')return {AuthenticationType:{FACIAL_RECOGNITION:2}};
   if(id.startsWith('@/'))return load(path.join('src',id.slice(2)));
   if(id.startsWith('.'))return load(path.resolve(path.dirname(file),id));
   throw Error('Unexpected external dependency: '+id);
  };
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  vm.runInNewContext('(function(require,module,exports,process,setTimeout){'+code+'})',{},{filename:file})(requireLocal,module,module.exports,{env:{EXPO_PUBLIC_DEMO_MODE:String(demo)}},(cb,ms)=>{delays.push(ms);queueMicrotask(cb);});
  return module.exports;
 }
 return {load,storage,delays};
}
(async()=>{
 const env=environment();const {load,storage,delays}=env;
 const selected=load('src/services/wallet/index');assert.equal(selected.walletMode,'mock');
 const app=load('src/services/appDataService');assert.equal(await app.walletService.getBalance(),52.3);
 assert.equal((await app.transactionService.list()).length,3);
 assert.equal((await load('src/services/eventService').eventService.list()).length,2);
 const controller=load('src/demo/demo.controller');
 const payments=load('src/services/demo/demo-payment.service').demoPaymentService;
 const wallet=new (load('src/services/demo/demo-wallet.service').DemoWalletService)();
 assert.equal(await wallet.getAccount(),null);
 await wallet.createWithPasskey({displayName:'Joaco',username:'joaco'});
 assert.equal((await wallet.getBalance()).amount,52.3);assert.equal(delays[0],1100);
 const request=await payments.create(10);
 assert.equal(await payments.pay(request.id,false),null,'approval must be explicit');
 const [first,duplicate]=await Promise.all([payments.pay(request.id,true),payments.pay(request.id,true)]);
 assert.equal(first.id,duplicate.id,'duplicate taps are idempotent');
 assert.equal((await wallet.getBalance()).amount,42.3);
 const automatic=await payments.create(3);assert.equal((await payments.pay(automatic.id,false)).status,'auto');
 assert.equal((await wallet.getBalance()).amount,39.3);
 const blocked=await payments.create(100);assert.equal(await payments.pay(blocked.id,true),null);
 assert.equal((await payments.get(blocked.id)).status,'blocked');assert.equal((await wallet.getBalance()).amount,39.3);
 const rejected=await payments.create(10);await payments.reject(rejected.id);assert.equal(await payments.pay(rejected.id,true),null);
 const security=load('src/services/security/local-auth.service');assert.equal((await security.authenticate()).success,true);
 await security.setAppLockEnabled(true);
 const onboarding=load('src/features/onboarding/services/onboardingStorage');await onboarding.markOnboardingCompleted();
 assert.equal(await onboarding.hasCompletedOnboarding(),true);
 await controller.resetDemoState();assert.equal((await wallet.getBalance()).amount,52.3);assert.equal(await wallet.getAccount(),null);
 assert.equal((await controller.readDemoState()).requests.length,0);assert.equal(await onboarding.hasCompletedOnboarding(),false);
 assert.equal(storage.get('patopay:onboarding:profile:v1'),'REAL PROFILE');assert.equal(storage.get('patopay:security:app-lock-enabled:v1'),'true');
 assert.ok(delays.every(ms=>ms<=1500));
 const pending=await payments.create(10);const running=payments.pay(pending.id,true);await controller.resetDemoState();await running;assert.equal((await wallet.getBalance()).amount,52.3);
 const real=environment(false);
 await assert.rejects(real.load('src/services/appDataService').walletService.getBalance(),/conexión/);
 await real.load('src/features/onboarding/services/onboardingStorage').markOnboardingCompleted('user-a');assert.equal(real.storage.get('patopay:onboarding:v2:user-a:completed'),'true');
 assert.equal(await real.load('src/features/onboarding/services/onboardingStorage').hasCompletedOnboarding('user-b'),false);
 assert.throws(()=>real.load('src/demo/demo.controller').resetDemoState(),/disabled/);
 console.log('PASS: approval, automatic, blocked, rejection, duplicate payment, balances, fixed timing, simulated auth, isolated storage, reset and reset during payment.');
})().catch(error=>{console.error(error);process.exitCode=1;});

