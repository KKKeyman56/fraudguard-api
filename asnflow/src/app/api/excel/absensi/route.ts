import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateAbsensi } from '@/lib/excel/absensi';
import type { AbsensiData } from '@/types';

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

  const body: AbsensiData = await req.json();

  if (!body.instansi || !body.unitKerja || !body.bulan || !body.tahun) {
    return NextResponse.json({ error: 'Field instansi, unitKerja, bulan, dan tahun wajib diisi.' }, { status: 422 });
  }

  if (!Array.isArray(body.pegawai) || body.pegawai.length === 0) {
    return NextResponse.json({ error: 'Daftar pegawai tidak boleh kosong.' }, { status: 422 });
  }

  const invalidPegawai = body.pegawai.some((p) => !p.nama || !p.nip || !p.jabatan);
  if (invalidPegawai) {
    return NextResponse.json({ error: 'Setiap pegawai harus memiliki nama, NIP, dan jabatan.' }, { status: 422 });
  }

  const buffer = await generateAbsensi(body);
  const bulanPadded = String(body.bulan).padStart(2, '0');
  const fileName = `Absensi_${bulanPadded}_${body.tahun}_${Date.now()}.xlsx`;

  // Log download
  await supabase.from('downloads').insert({
    user_id: user.id,
    tool_type: 'absensi',
    file_name: fileName,
    metadata: {
      instansi: body.instansi,
      unitKerja: body.unitKerja,
      bulan: body.bulan,
      tahun: body.tahun,
      jumlahPegawai: body.pegawai.length,
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
