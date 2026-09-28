import {apiRequest} from '@/services/api/patopayApi';

export type ApiAsset={
  id:string;
  network:'testnet';
  contract_address:string;
  code:'USDC';
  decimals:7;
  enabled:boolean;
};

export const assetRepository={
  list:()=>apiRequest<ApiAsset[]>('/api/v1/assets'),
};
