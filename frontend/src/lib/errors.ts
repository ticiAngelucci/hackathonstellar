export class AppError extends Error{
  constructor(message:string,readonly code='unknown'){super(message);this.name='AppError';}
}
export function userMessage(error:unknown,fallback='No pudimos completar la operación. Probá nuevamente.'){
  return error instanceof AppError?error.message:fallback;
}
export function checkResult(error:{code?:string;message?:string}|null,fallback:string){
  if(!error)return;
  const message=error.code==='23505'?'Ese dato ya está en uso. Elegí otro.':error.code==='42501'?'Tu cuenta no tiene permiso para esta operación.':fallback;
  throw new AppError(message,error.code);
}
