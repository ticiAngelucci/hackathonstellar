import {beforeEach,describe,expect,it,vi} from 'vitest';

const {apiRequest}=vi.hoisted(()=>({apiRequest:vi.fn()}));
vi.mock('@/services/api/patopayApi',()=>({apiRequest}));

import {requireUsdcAsset} from './asset.service';

describe('requireUsdcAsset',()=>{
  beforeEach(()=>apiRequest.mockReset());

  it('resolves the enabled canonical USDC asset from the API',async()=>{
    const asset={id:'asset-1',network:'testnet',contract_address:'C'.padEnd(56,'A'),code:'USDC',decimals:7,enabled:true};
    apiRequest.mockResolvedValue([asset]);

    await expect(requireUsdcAsset()).resolves.toEqual(asset);
    expect(apiRequest).toHaveBeenCalledWith('/api/v1/assets');
  });

  it('rejects when the API does not expose enabled Testnet USDC',async()=>{
    apiRequest.mockResolvedValue([
      {id:'asset-2',network:'testnet',contract_address:'C'.padEnd(56,'B'),code:'USDC',decimals:7,enabled:false},
    ]);

    await expect(requireUsdcAsset()).rejects.toThrow('USDC Testnet no está habilitado.');
  });
});
