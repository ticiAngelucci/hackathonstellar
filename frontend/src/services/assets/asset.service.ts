import {assetRepository,type ApiAsset} from '@/services/assets/asset.repository';
import {AppError} from '@/lib/errors';

export async function requireUsdcAsset():Promise<ApiAsset>{
  const assets=await assetRepository.list();
  const asset=assets.find(item=>item.code==='USDC'&&item.network==='testnet'&&item.decimals===7&&item.enabled);
  if(!asset)throw new AppError('USDC Testnet no está habilitado.','configuration');
  return asset;
}
