import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateLaporan } from '@/lib/excel/laporan';
import type { LaporanData } from '@/types';

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

  const body: LaporanData = await req.json();

  if (!body.instansi || !body.unitKerja || !body.bulan || !body.tahun) {
    return NextResponse.json({ error: 'Field instansi, unitKerja, bulan, dan tahun wajib diisi.' }, { status: 422 });
  }

  if (!Array.isArray(body.kegiatan) || body.kegiatan.length === 0) {
    return NextResponse.json({ error: 'Daftar kegiatan tidak boleh kosong.' }, { status: 422 });
  }

  const invalidKegiatan = body.kegiatan.some(
    (k) => !k.namaKegiatan || !k.tanggal || !k.tempat || !k.pelaksana || !k.hasil
  );
  if (invalidKegiatan) {
    return NextResponse.json(
      { error: 'Setiap kegiatan harus memiliki nama kegiatan, tanggal, tempat, pelaksana, dan hasil.' },
      { status: 422 }
    );
  }

  const buffer = await generateLaporan(body);
  const bulanPadded = String(body.bulan).padStart(2, '0');
  const fileName = `Laporan_${bulanPadded}_${body.tahun}_${Date.now()}.xlsx`;

  // Log download
  await supabase.from('downloads').insert({
    user_id: user.id,
    tool_type: 'laporan',
    file_name: fileName,
    metadata: {
      instansi: body.instansi,
      unitKerja: body.unitKerja,
      bulan: body.bulan,
      tahun: body.tahun,
      jumlahKegiatan: body.kegiatan.length,
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
