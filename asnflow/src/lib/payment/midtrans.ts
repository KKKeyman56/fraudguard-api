import MidtransClient from 'midtrans-client';

const snap = new MidtransClient.Snap({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  serverKey: process.env.MIDTRANS_SERVER_KEY!,
  clientKey: process.env.MIDTRANS_CLIENT_KEY!,
});

export interface MidtransParams {
  orderId: string;
  userId: string;
  email: string;
  amount: number;
  itemName: string;
}

export async function createTransaction(params: MidtransParams) {
  const { orderId, email, amount } = params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await snap.createTransaction({
    transaction_details: { order_id: orderId, gross_amount: amount },
    customer_details: { email },
  } as any);
  return result as { token: string; redirect_url: string };
}

export async function verifyTransaction(orderId: string) {
  const core = new MidtransClient.CoreApi({
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
    serverKey: process.env.MIDTRANS_SERVER_KEY!,
    clientKey: process.env.MIDTRANS_CLIENT_KEY!,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (core as any).transaction.status(orderId);
}

export const PRO_PRICE = 49000;
export const PRO_PRICE_LABEL = 'ASNFlow Pro - Bulanan';
