import {AppError} from './errors';
export function decimalToMinorUnits(amount:string,decimals=7):string{
 if(!Number.isInteger(decimals)||decimals<0||decimals>18)throw new AppError('El activo no tiene una escala válida.');
 const clean=amount.trim().replace(',','.');
 if(!/^\d+(?:\.\d+)?$/.test(clean))throw new AppError('Ingresá un monto válido.');
 const [whole,fraction='']=clean.split('.');if(fraction.length>decimals)throw new AppError(`Este activo admite hasta ${decimals} decimales.`);
 const minor=BigInt(whole)*10n**BigInt(decimals)+BigInt(fraction.padEnd(decimals,'0')||'0');
 if(minor<0n||minor>9000000000000000n)throw new AppError('El monto está fuera del rango permitido.');return minor.toString();
}
export function formatMinorUnits(amount:string|number,decimals=7){
 const raw=String(amount);
 if(!/^(0|[1-9]\d*)$/.test(raw)||!Number.isInteger(decimals)||decimals<0||decimals>18)throw new AppError('No pudimos interpretar el monto.');
 const value=BigInt(raw),scale=10n**BigInt(decimals);const fraction=(value%scale).toString().padStart(decimals,'0').replace(/0+$/,'');return `${value/scale}${fraction?'.'+fraction:''}`;
}

/** Supabase RPC bigint arguments are JSON numbers. Validate before crossing that boundary. */
export function minorUnitsToRpcNumber(amount:string):number{
 if(!/^(0|[1-9]\d*)$/.test(amount))throw new AppError('El monto debe expresarse en unidades enteras.');
 const value=BigInt(amount);
 if(value>9000000000000000n||value>BigInt(Number.MAX_SAFE_INTEGER))throw new AppError('El monto está fuera del rango permitido.');
 return Number(value);
}

export const toMinor=(amount:string,decimals:number)=>Number(decimalToMinorUnits(amount,decimals));
export const formatMinor=(amount:number,decimals:number)=>formatMinorUnits(amount,decimals);
