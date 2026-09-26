import {readDemoState,mutateDemo,demoGeneration} from '@/demo/demo.controller';
import {demoWait} from '@/demo/demo.config';
import {paymentDecision} from './demo-policy.service';
export const PAYMENT_STEPS=[{text:'Pato está revisando tus reglas...',ms:500},{text:'Este pago necesita tu aprobación.',ms:500},{text:'Preparando transacción...',ms:700},{text:'Enviando el pago...',ms:900}];
export const demoPaymentService={
 create(amount:number){if(!Number.isFinite(amount)||amount<=0)throw new Error('Ingresá un monto válido.');return mutateDemo(s=>{const request={id:'demo-request-'+(++s.sequence),amount,title:amount===3?'Spotify':'Asado del viernes',status:'pending' as const};s.requests.push(request);return request;});},
 async get(id:string){return (await readDemoState()).requests.find(r=>r.id===id);},
 block(id:string){return mutateDemo(s=>{const r=s.requests.find(r=>r.id===id);if(r?.status==='pending'){r.status='blocked';s.transactions.unshift({id:r.id,title:r.title,subtitle:'Bloqueado por tus reglas.',amount:-r.amount,status:'blocked',icon:'shield'});}});},
 reject(id:string){return mutateDemo(s=>{const r=s.requests.find(r=>r.id===id);if(r?.status==='pending')r.status='rejected';});},
 async pay(id:string,approved:boolean,onStep:(index:number)=>void=()=>{}){
  const generation=demoGeneration();
  for(let i=0;i<PAYMENT_STEPS.length;i++){onStep(i);await demoWait(PAYMENT_STEPS[i].ms);}
  return mutateDemo(s=>{if(generation!==demoGeneration())return null;const r=s.requests.find(r=>r.id===id);if(!r)throw new Error('Solicitud no disponible.');if(r.txId)return s.transactions.find(t=>t.id===r.txId)!;if(r.status!=='pending')return null;
   const decision=paymentDecision(s.policy,r.amount,s.spent);
   if(decision==='blocked'){r.status='blocked';s.transactions.unshift({id:r.id,title:r.title,amount:-r.amount,status:'blocked',icon:'shield'});return null;}
   if(decision==='approval'&&!approved)return null;
   if(r.amount>s.balance)throw new Error('Tu saldo no alcanza para este pago.');
   s.balance=Math.round((s.balance-r.amount)*100)/100;s.spent+=r.amount;r.status='paid';r.txId='demo-tx-'+(++s.sequence);
   const tx={id:r.txId,title:r.title,subtitle:decision==='auto'?'Pato lo pagó automáticamente ✓':'Transacción completada',amount:-r.amount,status:decision==='auto'?'auto' as const:'paid' as const,icon:'checkmark',txHash:'DEMO-7F82-'+s.sequence+'-PATO'};s.transactions=s.transactions.filter(t=>t.id!=='seed-asado'||r.title!=='Asado del viernes');s.transactions.unshift(tx);return tx;
  });
 }
};
export const demoTransactionService={async list(limit?:number){const ts=(await readDemoState()).transactions;return limit?ts.slice(0,limit):ts;},async get(id:string){const tx=(await readDemoState()).transactions.find(t=>t.id===id);if(!tx)throw new Error('Transacción no disponible.');return tx;}};
export const demoSubscriptionService={async list(){return new Map(Object.entries((await readDemoState()).subscriptions));},set(id:string,enabled:boolean){return mutateDemo(s=>s.subscriptions[id]=enabled);}};
