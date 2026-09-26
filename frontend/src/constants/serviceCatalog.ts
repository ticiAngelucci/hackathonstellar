import {DEMO_MODE} from '@/demo/demo.config';
import {ServiceSubscription} from '@/types';

// Catálogo del producto. El estado enabled de cada usuario vive en Supabase.
export const serviceCatalog:ServiceSubscription[]=DEMO_MODE?[
  {id:'spotify',name:'Spotify',amount:3,enabled:false,icon:'musical-notes'},
  {id:'netflix',name:'Netflix',amount:8,enabled:false,icon:'play-circle'},
  {id:'chatgpt',name:'ChatGPT',amount:20,enabled:false,icon:'sparkles'},
  {id:'drive',name:'Google Drive',amount:2,enabled:false,icon:'cloud'},
]:[
 {id:'electricity',name:'Electricidad',enabled:false,icon:'flash'},
 {id:'internet',name:'Internet',enabled:false,icon:'wifi'},
 {id:'water',name:'Agua',enabled:false,icon:'water'},
];
