import {DEMO_MODE} from '@/demo/demo.config';
import {PaymentRequestFlow} from '@/components/PaymentRequestFlow';
import {RealPaymentRequests} from '@/components/RealPaymentRequests';
export default DEMO_MODE?PaymentRequestFlow:RealPaymentRequests;
