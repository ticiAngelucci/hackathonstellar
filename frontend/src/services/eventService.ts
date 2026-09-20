import {supabaseRequest,SupabaseError} from '@/services/supabaseClient';

export type EventParticipant={
  user_id:string;
  display_name:string;
};

export type PatoPayEvent={
  id:string;
  name:string;
  creator_id:string;
  status:'draft';
  created_at:string;
  participants:EventParticipant[];
};

const currentUser={
  user_id:process.env.EXPO_PUBLIC_PATOPAY_USER_ID??'11111111-1111-4111-8111-111111111111',
  display_name:process.env.EXPO_PUBLIC_PATOPAY_DISPLAY_NAME??'Negro',
};

export const eventService={
  list(){
    return supabaseRequest<PatoPayEvent[]>('/events?select=id,name,creator_id,status,created_at,participants&order=created_at.asc');
  },
  async get(id:string){
    const events=await supabaseRequest<PatoPayEvent[]>(`/events?select=id,name,creator_id,status,created_at,participants&id=eq.${encodeURIComponent(id)}&limit=1`);
    const event=events[0];
    if(!event)throw new SupabaseError('El grupo ya no existe o no tenés acceso.',404);
    return event;
  },
  async create(name:string){
    const events=await supabaseRequest<PatoPayEvent[]>('/events?select=id,name,creator_id,status,created_at,participants',{
      method:'POST',
      headers:{Prefer:'return=representation'},
      body:JSON.stringify({
        name,
        creator_id:currentUser.user_id,
        status:'draft',
        participants:[currentUser],
      }),
    });

    const created=events[0];
    if(!created)throw new SupabaseError('Supabase no devolvió el grupo creado.');
    return created;
  },
};
