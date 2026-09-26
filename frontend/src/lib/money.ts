import {AppError} from './errors';
export function toMinor(amount:string,decimals:number):number{
 if(!Number.isInteger(decimals)||decimals<0||decimals>18)throw new AppError('El activo no tiene una escala válida.');
 const clean=amount.trim().replace(',','.');
 if(!/^\d+(?:\.\d+)?$/.test(clean))throw new AppError('Ingresá un monto válido.');
 const [whole,fraction='']=clean.split('.');if(fraction.length>decimals)throw new AppError(`Este activo admite hasta ${decimals} decimales.`);
 const minor=BigInt(whole)*10n**BigInt(decimals)+BigInt(fraction.padEnd(decimals,'0')||'0');
 if(minor<0n||minor>9000000000000000n)throw new AppError('El monto está fuera del rango permitido.');return Number(minor);
}
export function formatMinor(amount:number,decimals:number){
 if(!Number.isSafeInteger(amount)||!Number.isInteger(decimals)||decimals<0||decimals>18)throw new AppError('No pudimos interpretar el monto.');
 const value=BigInt(amount),scale=10n**BigInt(decimals);const fraction=(value%scale).toString().padStart(decimals,'0').replace(/0+$/,'');return `${value/scale}${fraction?'.'+fraction:''}`;
}
