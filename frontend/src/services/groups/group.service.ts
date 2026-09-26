import {groupRepository} from '@/repositories/group.repository';
import {requireUserId} from '@/services/auth/auth.service';
import {AppError} from '@/lib/errors';
export const realGroupService={
 async list(){return groupRepository.list(await requireUserId());},
 async get(id:string){return groupRepository.get(id);},
 async create(name:string){if(!name.trim()||name.trim().length>100)throw new AppError('Escribí un nombre de hasta 100 caracteres.');return groupRepository.create(await requireUserId(),name.trim());},
 async updateGroup(id:string,name:string,version:number){return groupRepository.update(id,await requireUserId(),name,version);},
 async getGroupMembers(id:string){return groupRepository.members(id,await requireUserId());},
 async inviteMember(){throw new AppError('Las invitaciones todavía no están disponibles.','unsupported');},
 async acceptInvitation(){throw new AppError('Las invitaciones todavía no están disponibles.','unsupported');},
};
