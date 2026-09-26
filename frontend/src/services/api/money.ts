import {AppError} from '@/lib/errors';
export function decimalToMinorUnits(input:string,scale=7):string{
 const normalized=input.trim().replace(',','.');
 if(!/^\d+(?:\.\d+)?$/.test(normalized))throw new AppError('Ingresá un monto válido.');
 const [whole,fraction='']=normalized.split('.');
 if(fraction.length>scale)throw new AppError(`El monto admite hasta ${scale} decimales.`);
 const units=BigInt(whole)*10n**BigInt(scale)+BigInt(fraction.padEnd(scale,'0')||'0');
 if(units>9000000000000000n)throw new AppError('El monto está fuera del rango permitido.');
 return units.toString();
}
export function formatMinorUnits(input:string,scale=7):string{
 if(!/^(0|[1-9]\d*)$/.test(input))throw new AppError('No pudimos interpretar el monto.');
 const units=BigInt(input),base=10n**BigInt(scale);
 const fraction=(units%base).toString().padStart(scale,'0').replace(/0+$/,'');
 return `${units/base}${fraction?'.'+fraction:''}`;
}
export function configuredAssetId(){return process.env.EXPO_PUBLIC_PATOPAY_USDC_ASSET_ID?.trim()??'';}
export function requireAssetId(){const id=configuredAssetId();if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new AppError('Falta configurar el activo USDC de Pato Pay.','configuration');return id;}
