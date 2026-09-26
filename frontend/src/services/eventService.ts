import {DEMO_MODE} from '@/demo/demo.config';
import {demoGroupService} from '@/services/demo/demo-group.service';
export type EventParticipant={user_id:string;display_name:string};
export type PatoPayEvent={id:string;name:string;creator_id:string;status:'draft';created_at:string;participants:EventParticipant[];balance?:number;membersVisible?:boolean;version?:number};
export interface GroupService{
 list():Promise<PatoPayEvent[]>;
 get(id:string):Promise<PatoPayEvent>;
 create(name:string):Promise<PatoPayEvent>;
 updateGroup(id:string,name:string,version:number):Promise<PatoPayEvent>;
}
export const eventService:GroupService=DEMO_MODE?demoGroupService:require('@/services/groups/group.service').realGroupService;
