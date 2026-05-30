import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createTransaction, PRO_PRICE, PRO_PRICE_LABEL } from '@/lib/payment/midtrans';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orderId = `ASNFLOW-PRO-${user.id.slice(0, 8)}-${Date.now()}`;

  const result = await createTransaction({
    orderId,
    userId: user.id,
    email: user.email ?? '',
    amount: PRO_PRICE,
    itemName: PRO_PRICE_LABEL,
  });

  return NextResponse.json({ token: result.token, redirectUrl: result.redirect_url });
}
