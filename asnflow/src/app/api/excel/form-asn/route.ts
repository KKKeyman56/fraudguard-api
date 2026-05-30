import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateFormASN } from '@/lib/excel/form-asn';
import type { FormASNData } from '@/types';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Check download limit
  const { data: membership } = await supabase
    .from('memberships')
    .select('plan')
    .eq('user_id', user.id)
    .single();

  if (membership?.plan === 'free') {
    const { data: count } = await supabase.rpc('get_monthly_download_count', { p_user_id: user.id });
    if ((count ?? 0) >= 5) {
      return NextResponse.json({ error: 'Batas download bulan ini sudah tercapai. Upgrade ke Pro untuk download tak terbatas.' }, { status: 403 });
    }
  }

  const body: FormASNData = await req.json();
  if (!body.nama || !body.nip || !body.jabatan || !body.golongan || !body.instansi || !body.tanggal) {
    return NextResponse.json({ error: 'Semua field wajib diisi.' }, { status: 422 });
  }

  const buffer = await generateFormASN(body);
  const fileName = `FormASN_${body.nip}_${Date.now()}.xlsx`;

  // Log download
  await supabase.from('downloads').insert({
    user_id: user.id,
    tool_type: 'form-asn',
    file_name: fileName,
    metadata: { nama: body.nama, instansi: body.instansi },
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  });
}
