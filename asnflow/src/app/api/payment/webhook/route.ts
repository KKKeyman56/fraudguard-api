import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { verifyTransaction } from '@/lib/payment/midtrans';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Verify Midtrans signature
  const { order_id, status_code, gross_amount, signature_key } = body;
  const serverKey = process.env.MIDTRANS_SERVER_KEY ?? '';
  const expectedSig = crypto
    .createHash('sha512')
    .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
    .digest('hex');

  if (signature_key !== expectedSig) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
  }

  const transaction = await verifyTransaction(order_id);
  const transactionStatus = (transaction as { transaction_status: string }).transaction_status;

  if (transactionStatus === 'settlement' || transactionStatus === 'capture') {
    // Extract userId from order_id: ASNFLOW-PRO-{userId8chars}-{timestamp}
    const parts = order_id.split('-');
    const userIdPrefix = parts[2];

    const supabase = await createServiceClient();

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .like('id', `${userIdPrefix}%`);

    if (profiles && profiles.length > 0) {
      const userId = profiles[0].id;
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      await supabase.from('memberships').upsert({
        user_id: userId,
        plan: 'pro',
        status: 'active',
        midtrans_order_id: order_id,
        midtrans_transaction_id: (transaction as { transaction_id: string }).transaction_id,
        started_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    }
  }

  return NextResponse.json({ status: 'ok' });
}
