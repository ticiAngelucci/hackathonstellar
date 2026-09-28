import {beforeEach,describe,expect,it,vi} from 'vitest';

const {create,defaultAsset,requireUserId}=vi.hoisted(()=>({create:vi.fn(),defaultAsset:vi.fn(),requireUserId:vi.fn()}));
vi.mock('@/repositories/payment.repository',()=>({paymentRepository:{create,defaultAsset}}));
vi.mock('@/services/auth/auth.service',()=>({requireUserId}));

import {paymentService} from './payment.service';

describe('paymentService.createPaymentRequest',()=>{
  beforeEach(()=>{
    create.mockReset();defaultAsset.mockReset();requireUserId.mockResolvedValue('requester-id');
    defaultAsset.mockResolvedValue({id:'canonical-usdc-id',network:'testnet',contract_address:'C'.padEnd(56,'A'),code:'USDC',decimals:7,enabled:true});
    create.mockResolvedValue({id:'request-id',status:'pending_approval'});
  });

  it('uses the enabled Supabase asset and its decimals',async()=>{
    await paymentService.createPaymentRequest({payerId:'payer-id',amount:'1.5',concept:'Cena',idempotencyKey:'request-1'});
    expect(defaultAsset).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledWith({payer_profile_id:'payer-id',asset_id:'canonical-usdc-id',amount_minor:'15000000',memo:'Cena'},'request-1');
  });
});
