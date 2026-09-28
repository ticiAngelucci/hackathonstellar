import {beforeEach,describe,expect,it,vi} from 'vitest';

const {create,requireUserId,requireUsdcAsset}=vi.hoisted(()=>({
  create:vi.fn(),
  requireUserId:vi.fn(),
  requireUsdcAsset:vi.fn(),
}));
vi.mock('@/repositories/payment.repository',()=>({paymentRepository:{create}}));
vi.mock('@/services/auth/auth.service',()=>({requireUserId}));
vi.mock('@/services/assets/asset.service',()=>({requireUsdcAsset}));

import {realPaymentService} from './payment.service';

describe('realPaymentService.createPaymentRequest',()=>{
  beforeEach(()=>{
    create.mockReset();
    requireUserId.mockResolvedValue('requester-id');
    requireUsdcAsset.mockResolvedValue({id:'canonical-usdc-id',network:'testnet',contract_address:'C'.padEnd(56,'A'),code:'USDC',decimals:7,enabled:true});
    create.mockResolvedValue({id:'request-id',status:'pending_approval'});
  });

  it('uses the enabled asset returned by FastAPI instead of a frontend env id',async()=>{
    await realPaymentService.createPaymentRequest({
      payerId:'payer-id',amount:'1.5',concept:'Cena',idempotencyKey:'request-1',
    });

    expect(requireUsdcAsset).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledWith({
      payer_profile_id:'payer-id',asset_id:'canonical-usdc-id',amount_minor:'15000000',memo:'Cena',
    },'request-1');
  });
});
