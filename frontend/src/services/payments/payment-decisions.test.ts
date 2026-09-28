import {beforeEach,describe,expect,it,vi} from 'vitest';

const {get,decide,requireUserId}=vi.hoisted(()=>({get:vi.fn(),decide:vi.fn(),requireUserId:vi.fn()}));
vi.mock('@/repositories/payment.repository',()=>({paymentRepository:{get,decide}}));
vi.mock('@/services/auth/auth.service',()=>({requireUserId}));

import {paymentService} from './payment.service';

const row={id:'request-1',requester_id:'requester',payer_id:'payer',asset_id:'asset',amount_minor:'1000000',memo:'Cena',status:'pending_approval',version:4,asset:{id:'asset',network:'testnet',contract_address:'C'.padEnd(56,'A'),code:'USDC',decimals:7,enabled:true,created_at:'now'}};

describe('payment decisions',()=>{
  beforeEach(()=>{get.mockReset();decide.mockReset();requireUserId.mockResolvedValue('payer');get.mockResolvedValue(row);decide.mockResolvedValue({id:'request-1',status:'approved',version:5,next_action:'prepare_sign_and_execute'});});
  it('approves with the server version and deterministic idempotency key',async()=>{await paymentService.approvePaymentRequest('request-1');expect(decide).toHaveBeenCalledWith('request-1','approve',4,'payment-decision:approve:request-1:4');});
  it('rejects with the server version and deterministic idempotency key',async()=>{await paymentService.rejectPaymentRequest('request-1');expect(decide).toHaveBeenCalledWith('request-1','reject',4,'payment-decision:reject:request-1:4');});
});
