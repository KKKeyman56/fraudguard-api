import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateArsipSurat } from '@/lib/excel/arsip-surat';
import type { ArsipSuratExportData } from '@/types';

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
      return NextResponse.json(
        { error: 'Batas download bulan ini sudah tercapai. Upgrade ke Pro untuk download tak terbatas.' },
        { status: 403 }
      );
    }
  }

  const body: ArsipSuratExportData = await req.json();

  if (!body.instansi || !body.unitKerja || !body.periode) {
    return NextResponse.json({ error: 'Field instansi, unitKerja, dan periode wajib diisi.' }, { status: 422 });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'Daftar surat tidak boleh kosong.' }, { status: 422 });
  }

  const invalidItems = body.items.some(
    (s) => !s.nomor_surat || !s.tanggal || !s.pengirim || !s.tujuan || !s.perihal || !s.jenis
  );
  if (invalidItems) {
    return NextResponse.json(
      { error: 'Setiap surat harus memiliki nomor surat, tanggal, pengirim, tujuan, perihal, dan jenis.' },
      { status: 422 }
    );
  }

  const buffer = await generateArsipSurat(body);
  const safePeriode = body.periode.replace(/\s+/g, '_');
  const fileName = `ArsipSurat_${safePeriode}_${Date.now()}.xlsx`;

  // Log download
  await supabase.from('downloads').insert({
    user_id: user.id,
    tool_type: 'arsip-surat',
    file_name: fileName,
    metadata: {
      instansi: body.instansi,
      unitKerja: body.unitKerja,
      periode: body.periode,
      jumlahSurat: body.items.length,
    },
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  });
}
