const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');

const root=path.resolve(__dirname,'..');

function runtime(overrides={},extraEnv={}){
  const cache=new Map();
  const env={EXPO_PUBLIC_DEMO_MODE:'false',EXPO_PUBLIC_SUPABASE_URL:'https://project.supabase.co',EXPO_PUBLIC_SUPABASE_ANON_KEY:'sb_publishable_test',EXPO_PUBLIC_WALLET_MODE:'mock',EXPO_PUBLIC_STELLAR_NETWORK:'testnet',...extraEnv};
  let clients=0;
  const fakeClient={schema(){return fakeClient;},auth:{}};
  function load(file){
    file=path.resolve(root,file);if(!/\.[cm]?[jt]sx?$/.test(file))file+='.ts';
    if(cache.has(file))return cache.get(file).exports;
    const module={exports:{}};cache.set(file,module);
    const requireLocal=id=>{
      if(Object.prototype.hasOwnProperty.call(overrides,id))return overrides[id];
      if(id==='react-native-url-polyfill/auto')return {};
      if(id==='react-native')return {Platform:{OS:'web'}};
      if(id==='expo-constants')return {__esModule:true,default:{executionEnvironment:'bare'},ExecutionEnvironment:{StoreClient:'storeClient'}};
      if(id==='expo-linking')return {createURL:path=>`https://example.test${path}`};
      if(id==='@react-native-async-storage/async-storage')return {};
      if(id==='@supabase/supabase-js')return {createClient(){clients++;return fakeClient;},processLock:()=>{}};
      if(id.startsWith('@/'))return load(path.join('src',id.slice(2)));
      if(id.startsWith('.'))return load(path.resolve(path.dirname(file),id));
      throw new Error(`Unexpected dependency ${id} from ${file}`);
    };
    const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText;
    vm.runInNewContext('(function(require,module,exports,process){'+code+'})',{URL,URLSearchParams,console,setTimeout,clearTimeout},{filename:file})(requireLocal,module,module.exports,{env});
    return module.exports;
  }
  return {load,get clients(){return clients;}};
}

(async()=>{
  const publicKey=runtime().load('src/lib/public-key');
  assert.throws(()=>publicKey.assertPublicKey('sb_secret_example'));
  const jwt=role=>'header.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.signature';
  assert.throws(()=>publicKey.assertPublicKey(jwt('service_role')));
  publicKey.assertPublicKey(jwt('anon'));

  const connection=runtime();
  const {getSupabase}=connection.load('src/lib/supabase');
  assert.equal(getSupabase(),getSupabase());
  assert.equal(connection.clients,1,'Supabase client must be a singleton');

  const demo=runtime({}, {EXPO_PUBLIC_DEMO_MODE:'true',EXPO_PUBLIC_SUPABASE_URL:'',EXPO_PUBLIC_SUPABASE_ANON_KEY:''});
  assert.equal(demo.load('src/config/env').validateEnvironment().mode,'demo','demo must not require Supabase');

  const money=runtime().load('src/lib/money');
  assert.equal(money.decimalToMinorUnits('0.0000001'),'1');
  assert.equal(money.formatMinorUnits('123456789'),'12.3456789');
  assert.equal(money.decimalToMinorUnits('900000000'),'9000000000000000');
  assert.equal(money.minorUnitsToRpcNumber('9000000000000000'),9000000000000000);
  assert.throws(()=>money.decimalToMinorUnits('1.00000001'));

  let created;
  const asset={id:'asset-usdc',network:'testnet',contract_address:'C'.padEnd(56,'A'),code:'USDC',decimals:7,enabled:true,created_at:'2026-01-01T00:00:00Z'};
  const paymentRepository={
    async defaultAsset(){return asset;},
    async create(input,key){created={input,key};return {id:'request-1',status:'pending_approval'};},
    async list(){return [];},
    async get(){throw new Error('not used');},
  };
  const payments=runtime({'@/repositories/payment.repository':{paymentRepository},'@/services/auth/auth.service':{requireUserId:async()=> 'user-a'}}).load('src/services/payments/payment.service');
  await payments.paymentService.createPaymentRequest({payerId:'user-b',amount:'14.5',concept:'Asado',idempotencyKey:'stable-key'});
  assert.equal(created.input.amount_minor,'145000000');
  assert.equal(created.input.asset_id,'asset-usdc');
  assert.equal(created.key,'stable-key');
  const base={id:'request-1',requester_id:'user-b',payer_id:'user-a',source_wallet_id:'wallet-a',destination_wallet_id:'wallet-b',asset_id:asset.id,amount_minor:'100000000',memo:'Asado',policy_version_id:null,policy_snapshot:{},status:'approved',version:1,created_at:'2026-01-01T00:00:00Z',updated_at:'2026-01-01T00:00:00Z',asset};
  assert.equal(payments.mapRequest(base).status,'approved');
  assert.equal(payments.mapRequest(base).amount,'10');

  let groupCreate;
  const groupRepository={async list(){return [];},async get(){},async update(){},async members(){return [];},async create(name){groupCreate={name};return {id:'g1',name};}};
  const groups=runtime({'@/repositories/group.repository':{groupRepository}}).load('src/services/groups/group.service');
  await groups.groupService.create('  Viaje  ');
  assert.deepEqual(groupCreate,{name:'Viaje'});

  const session={user:{id:'user-a'}};
  let exchanged='';let tokens;
  const authRepository={
    async getSession(){return {data:{session:null},error:null};},
    async exchangeCodeForSession(code){exchanged=code;return {data:{session},error:null};},
    async setSession(accessToken,refreshToken){tokens={accessToken,refreshToken};return {data:{session},error:null};},
    async verifyTokenHash(){return {data:{session},error:null};},
  };
  const auth=runtime({'@/repositories/supabase/auth.repository':{supabaseAuthRepository:authRepository},'@/config/env':{env:{demoMode:false}},'./auth-redirect':{getAuthRedirectUrl:()=> 'patopay://auth/callback'}}).load('src/services/auth/auth.service');
  assert.equal((await auth.authService.completeEmailConfirmation('patopay://auth/callback?code=pkce-code')).user.id,'user-a');
  assert.equal(exchanged,'pkce-code');
  await auth.authService.completeEmailConfirmation('patopay://auth/callback#access_token=old-access&refresh_token=old-refresh');
  assert.deepEqual(tokens,{accessToken:'old-access',refreshToken:'old-refresh'});

  const sourceFiles=[...walk(path.join(root,'app')),...walk(path.join(root,'src'))].filter(file=>/\.[tj]sx?$/.test(file));
  const source=sourceFiles.map(file=>fs.readFileSync(file,'utf8')).join('\n');
  assert.doesNotMatch(source,/EXPO_PUBLIC_PATOPAY_API_URL|apiRequest\s*[<(]/,'frontend source must not call a local/FastAPI backend');
  const example=fs.readFileSync(path.join(root,'.env.example'),'utf8');
  assert.doesNotMatch(example,/SERVICE_ROLE|PATOPAY_API_URL|127\.0\.0\.1|localhost/);
  assert.match(source,/emailRedirectTo/,'sign-up must always provide its callback');
  assert.match(source,/patopay:\/\/auth\/callback/,'the stable mobile callback must stay configured');
  console.log('PASS: env isolation, public Supabase key, singleton client, exact money, services/repositories and no local backend dependency.');
})().catch(error=>{console.error(error);process.exitCode=1;});

function walk(directory){
  return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(directory,entry.name)):[path.join(directory,entry.name)]);
}
