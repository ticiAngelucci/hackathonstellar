import {DEMO_MODE} from '@/demo/demo.config';
import {eventService} from '@/services/eventService';
import {AppError} from '@/lib/errors';
export type GroupFund={groupName:string;available:boolean;balance?:number;stakingLabel:string;message:string};
export const fundService={
 async getGroupFund(id:string):Promise<GroupFund>{
  const group=await eventService.get(id);
  return DEMO_MODE?{groupName:group.name,available:true,balance:group.balance,stakingLabel:'Staking activo',message:'El fondo puede trabajar mientras esperan usarlo.'}:{groupName:group.name,available:false,stakingLabel:'Disponible próximamente',message:'Los aportes, retiros y el rendimiento del fondo todavía no están disponibles.'};
 },
 async getContributions(){throw new AppError('Los aportes todavía no están disponibles.','unsupported');},
 async contribute(){throw new AppError('Los aportes todavía no están disponibles.','unsupported');},
 async withdraw(){throw new AppError('Los retiros todavía no están disponibles.','unsupported');},
};
