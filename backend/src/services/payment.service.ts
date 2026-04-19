import { ENV } from '../config/env';

// Dummy payment gateway - Razorpay-ready architecture
// In production, replace with actual Razorpay SDK integration

interface PaymentOrder {
  orderId: string;
  amount: number;
  currency: string;
  status: 'created' | 'paid' | 'failed';
  gatewayOrderId: string | null;
}

interface PaymentVerification {
  orderId: string;
  paymentId: string;
  signature: string;
}

export async function createPaymentOrder(amount: number): Promise<PaymentOrder> {
  const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  // In production with Razorpay:
  // const razorpay = new Razorpay({ key_id: ENV.razorpay.keyId, key_secret: ENV.razorpay.keySecret });
  // const order = await razorpay.orders.create({ amount: amount * 100, currency: 'INR' });
  // return { orderId, amount, currency: 'INR', status: 'created', gatewayOrderId: order.id };

  // Dummy: Immediately return success
  return {
    orderId,
    amount,
    currency: 'INR',
    status: 'created',
    gatewayOrderId: `rzp_dummy_${orderId}`,
  };
}

export async function verifyPayment(verification: PaymentVerification): Promise<boolean> {
  // In production with Razorpay:
  // const crypto = require('crypto');
  // const body = verification.orderId + '|' + verification.paymentId;
  // const expectedSignature = crypto.createHmac('sha256', ENV.razorpay.keySecret).update(body).digest('hex');
  // return expectedSignature === verification.signature;

  // Dummy: Always verify successfully
  return true;
}

export async function processRefund(paymentId: string, amount: number): Promise<boolean> {
  // In production: razorpay.payments.refund(paymentId, { amount: amount * 100 })
  console.log(`[Payment] Refund processed: ${paymentId} - Rs.${amount}`);
  return true;
}
