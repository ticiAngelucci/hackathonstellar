import type {DemoState} from './demo.types';
import type {WalletAccount} from '@/services/wallet/types';
export const demoAccount:WalletAccount={walletAddress:'GDEMO7XJ2K...PATO',address:'GDEMO7XJ2K...PATO',credentialId:'DEMO-CREDENTIAL',network:'testnet',status:'mock',signer:'mock'};
export function initialDemoState():DemoState{return {
 balance:52.30,wallet:null,staking:false,sequence:0,spent:0,requests:[],subscriptions:{},
 policy:{autoPayLimit:5,approvalLimit:30,blockAbove:30,dailyLimit:50,allowedRecipientsOnly:true},
 groups:[{id:'asado',name:'Asado del viernes',balance:120,creator_id:'demo-joaco',status:'draft',created_at:'2026-01-01T12:00:00Z',participants:['Joaco','Tici','Sofi','Nico','Luli'].map(display_name=>({user_id:'demo-'+display_name,display_name}))},{id:'bariloche',name:'Viaje Bariloche',balance:140,creator_id:'demo-joaco',status:'draft',created_at:'2026-01-01T12:00:00Z',participants:['Tici','Joaco','Sofi'].map(display_name=>({user_id:'demo-'+display_name,display_name}))}],
 transactions:[{id:'seed-asado',title:'Asado del viernes',subtitle:'Tu parte · pendiente',amount:-10,status:'pending',icon:'restaurant'},{id:'seed-spotify',title:'Spotify',subtitle:'Pago automático',amount:-3,status:'auto',icon:'musical-notes',txHash:'DEMO-SPOTIFY-PATO'},{id:'seed-viaje',title:'Fondo Viaje',subtitle:'Fondo común · staking activo',amount:40,status:'received',icon:'airplane'}]
};}
