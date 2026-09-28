export class AppError extends Error{
  constructor(message:string,readonly code='unknown'){super(message);this.name='AppError';}
}
export function userMessage(error:unknown,fallback='No pudimos completar la operación. Probá nuevamente.'){
  return error instanceof AppError?error.message:fallback;
}
export function checkResult(error:{code?:string;message?:string}|null,fallback:string){
  if(!error)return;
  if(typeof __DEV__!=='undefined'&&__DEV__)console.error('[Pato Pay data error]',error);
  const messages:Record<string,string>={
    '23505':'Ese dato ya está en uso. Elegí otro.',
    '40001':'Los datos cambiaron mientras guardabas. Actualizá y reintentá.',
    '42501':'Tu cuenta no tiene permiso para esta operación.',
    '22023':'Los datos enviados no son válidos para esta operación.',
    PGRST106:'Supabase todavía no expone el schema patopay. Agregalo en API Settings > Exposed schemas.',
    PGRST116:'No encontramos ese dato.',
  };
  throw new AppError(messages[error.code??'']??fallback,error.code);
}
