import {readDemoState,mutateDemo} from '@/demo/demo.controller';
export const demoStakingService={async get(){return (await readDemoState()).staking;},activate(){return mutateDemo(state=>state.staking=true);}};
