import {groupRepository} from '@/repositories/group.repository';
import {AppError} from '@/lib/errors';
export const groupService={
 async list(){return groupRepository.list();},
 async get(id:string){return groupRepository.get(id);},
 async create(name:string){if(!name.trim()||name.trim().length>100)throw new AppError('Escribí un nombre de hasta 100 caracteres.');return groupRepository.create(name.trim());},
 async updateGroup(id:string,name:string,version:number){if(!name.trim()||name.trim().length>100)throw new AppError('Escribí un nombre de hasta 100 caracteres.');return groupRepository.update(id,name.trim(),version);},
 async getGroupMembers(id:string){return groupRepository.members(id);},
 async inviteMember(){throw new AppError('Las invitaciones todavía no están disponibles.','unsupported');},
 async acceptInvitation(){throw new AppError('Las invitaciones todavía no están disponibles.','unsupported');},
};
