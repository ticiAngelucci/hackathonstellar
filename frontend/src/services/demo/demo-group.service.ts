import {readDemoState,mutateDemo} from '@/demo/demo.controller';
import {loadOnboardingProfile} from '@/features/onboarding/services/onboardingStorage';

async function currentDisplayName(){
  return (await loadOnboardingProfile())?.displayName.trim()||'Vos';
}

export const demoGroupService={
  async list(){
    const name=await currentDisplayName();
    return (await readDemoState()).groups.map(group=>({...group,participants:group.participants.map(participant=>
      participant.user_id.toLowerCase()==='demo-joaco'?{...participant,display_name:name}:participant
    )}));
  },
  async get(id:string){
    const group=(await demoGroupService.list()).find(group=>group.id===id);
    if(!group)throw new Error('No encontramos el grupo.');
    return group;
  },
  async updateGroup(id:string,name:string,_version:number){return mutateDemo(state=>{const group=state.groups.find(g=>g.id===id);if(!group)throw new Error('No encontramos el grupo.');group.name=name.trim();return group;});},
  async create(name:string){
    const display_name=await currentDisplayName();
    return mutateDemo(state=>{
      const group={id:'demo-group-'+(++state.sequence),name,balance:0,creator_id:'demo-joaco',status:'draft' as const,created_at:'2026-01-01T12:00:00Z',participants:[{user_id:'demo-joaco',display_name}]};
      state.groups.push(group);
      return group;
    });
  },
};
