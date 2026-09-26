// Reads only public Supabase configuration. Never writes credentials to backend files.
const path=require('node:path');const fs=require('node:fs');const os=require('node:os');const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');process.env.NODE_ENV||='development';require('@expo/env').load(root);
const e=process.env,url=e.EXPO_PUBLIC_SUPABASE_URL,key=e.EXPO_PUBLIC_SUPABASE_ANON_KEY||e.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if(!url||!key){console.error('Configure Supabase URL and public key in .env.local.');process.exit(1);}
const localPython=path.join(root,'.cache/backend-venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
const python=e.PATOPAY_LOCAL_PYTHON||(fs.existsSync(localPython)?localPython:'python');
const ips=Object.values(os.networkInterfaces()).flat().filter(a=>a&&a.family==='IPv4'&&!a.internal).map(a=>a.address);
const origins=['http://localhost:8081','http://127.0.0.1:8081','http://localhost:8091','http://127.0.0.1:8091',...ips.map(ip=>`http://${ip}:8081`)];
console.log('Local API: http://127.0.0.1:8000');for(const ip of ips)console.log(`Phone on same Wi-Fi: http://${ip}:8000`);
const child=spawn(python,['-m','uvicorn','patopay.main:app','--host','0.0.0.0','--port','8000'],{cwd:root,stdio:'inherit',windowsHide:true,env:{...e,PYTHONPATH:path.resolve(root,'../backend/src'),PYTHONDONTWRITEBYTECODE:'1',PATOPAY_SUPABASE_URL:url,PATOPAY_SUPABASE_PUBLISHABLE_KEY:key,PATOPAY_CORS_ORIGINS:JSON.stringify(origins)}});
child.on('error',()=>{console.error('Could not start Python. Install backend dependencies or set PATOPAY_LOCAL_PYTHON.');process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
process.on('SIGINT',()=>child.kill());process.on('SIGTERM',()=>child.kill());
