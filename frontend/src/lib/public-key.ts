import {AppError} from './errors';
function decodePayload(value:string){
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';let bits=0,buffer=0,result='';
 for(const char of value.replace(/-/g,'+').replace(/_/g,'/')){if(char==='=')break;const digit=alphabet.indexOf(char);if(digit<0)throw new Error('Invalid encoding');buffer=(buffer<<6)|digit;bits+=6;if(bits>=8){bits-=8;result+=String.fromCharCode((buffer>>bits)&255);}}
 return JSON.parse(result) as {role?:string};
}
export function assertPublicKey(key:string){
 if(key.startsWith('sb_publishable_'))return;
 try{const parts=key.split('.');if(parts.length===3&&decodePayload(parts[1]).role==='anon')return;}catch{}
 throw new AppError('La aplicación requiere una clave pública de Supabase.','configuration');
}
