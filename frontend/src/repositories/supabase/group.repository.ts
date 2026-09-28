import {appDatabase} from '@/lib/supabase';
import {AppError,checkResult} from '@/lib/errors';
import type {GroupRepository} from '@/repositories/contracts';
import type {EventRow} from '@/types/database.generated';

async function hydrate(events:EventRow[]){
  if(!events.length)return [];
  const ids=events.map(event=>event.id);
  const {data:members,error}=await appDatabase().from('event_participants').select('*').in('event_id',ids);
  checkResult(error,'No pudimos cargar los integrantes de tus grupos.');
  const participantRows=members??[];
  const userIds=[...new Set(participantRows.map(member=>member.user_id))];
  const {data:profiles,error:profilesError}=userIds.length?await appDatabase().from('profile_directory').select('id,display_name').in('id',userIds):{data:[],error:null};
  if(profilesError&&typeof __DEV__!=='undefined'&&__DEV__)console.warn('[Pato Pay member names]',profilesError);
  const names=new Map((profiles??[]).map(profile=>[profile.id,profile.display_name??'Miembro']));
  return events.map(event=>({id:event.id,name:event.name,creator_id:event.owner_id,status:event.status,created_at:event.created_at,version:event.version,membersVisible:!profilesError,participants:participantRows.filter(member=>member.event_id===event.id).map(member=>({user_id:member.user_id,display_name:names.get(member.user_id)??'Miembro'}))}));
}

async function one(event:EventRow|null){
  if(!event)throw new AppError('No encontramos ese grupo.','not_found');
  return (await hydrate([event]))[0];
}

export const supabaseGroupRepository:GroupRepository={
  async list(){
    const {data,error}=await appDatabase().from('events').select('id,owner_id,name,status,version,created_at,updated_at').order('created_at',{ascending:true}).order('id',{ascending:true});
    checkResult(error,'No pudimos cargar tus grupos.');
    return hydrate(data??[]);
  },
  async get(id){
    const event=(await this.list()).find(item=>item.id===id);
    if(!event)throw new AppError('No encontramos ese grupo.','not_found');
    return event;
  },
  async create(name){
    const {data,error}=await appDatabase().rpc('create_event_with_owner',{p_name:name});
    checkResult(error,'No pudimos crear el grupo.');
    return one(data);
  },
  async update(){
    throw new AppError('La edición de grupos todavía no forma parte de la API publicada.','unsupported');
  },
  async members(id){return (await this.get(id)).participants;},
};
