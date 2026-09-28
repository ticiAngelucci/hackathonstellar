import {readDemoState,mutateDemo} from '@/demo/demo.controller';
import {loadOnboardingProfile} from '@/features/onboarding/services/onboardingStorage';
import {AppError} from '@/lib/errors';
import type {GroupRepository} from '@/repositories/contracts';

async function currentDisplayName(){return (await loadOnboardingProfile())?.displayName.trim()||'Vos';}

export const demoGroupRepository:GroupRepository={
  async list(){
    const name=await currentDisplayName();
    return (await readDemoState()).groups.map(group=>({...group,participants:group.participants.map(participant=>participant.user_id.toLowerCase()==='demo-joaco'?{...participant,display_name:name}:participant)}));
  },
  async get(id){const group=(await this.list()).find(item=>item.id===id);if(!group)throw new AppError('No encontramos el grupo.','not_found');return group;},
  async update(id,name){return mutateDemo(state=>{const group=state.groups.find(item=>item.id===id);if(!group)throw new AppError('No encontramos el grupo.','not_found');group.name=name.trim();return group;});},
  async create(name){const display_name=await currentDisplayName();return mutateDemo(state=>{const group={id:'demo-group-'+(++state.sequence),name,balance:0,creator_id:'demo-joaco',status:'draft' as const,created_at:'2026-01-01T12:00:00Z',version:1,participants:[{user_id:'demo-joaco',display_name}]};state.groups.push(group);return group;});},
  async members(id){return (await this.get(id)).participants;},
};
