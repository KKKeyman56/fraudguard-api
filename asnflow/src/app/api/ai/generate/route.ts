import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateExcelData } from '@/lib/ai/openai';
import { generateFormASN } from '@/lib/excel/form-asn';
import { generateAbsensi } from '@/lib/excel/absensi';
import { generateLaporan } from '@/lib/excel/laporan';
import { generateArsipSurat } from '@/lib/excel/arsip-surat';
import type { FormASNData, AbsensiData, LaporanData, ArsipSuratExportData } from '@/types';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: membership } = await supabase.from('memberships').select('plan').eq('user_id', user.id).single();
  if (membership?.plan === 'free') {
    const { data: count } = await supabase.rpc('get_monthly_download_count', { p_user_id: user.id });
    if ((count ?? 0) >= 5) return NextResponse.json({ error: 'Kuota habis. Upgrade ke Pro.' }, { status: 403 });
  }

  const { prompt } = await req.json();
  if (!prompt) return NextResponse.json({ error: 'Prompt diperlukan.' }, { status: 422 });

  const aiResult = await generateExcelData(prompt);

  let buffer: Buffer;
  let fileName: string;

  switch (aiResult.toolType) {
    case 'form-asn':
      buffer = await generateFormASN(aiResult.data as FormASNData);
      fileName = `AI_FormASN_${Date.now()}.xlsx`;
      break;
    case 'absensi':
      buffer = await generateAbsensi(aiResult.data as AbsensiData);
      fileName = `AI_Absensi_${Date.now()}.xlsx`;
      break;
    case 'laporan':
      buffer = await generateLaporan(aiResult.data as LaporanData);
      fileName = `AI_Laporan_${Date.now()}.xlsx`;
      break;
    case 'arsip-surat':
      buffer = await generateArsipSurat(aiResult.data as ArsipSuratExportData);
      fileName = `AI_ArsipSurat_${Date.now()}.xlsx`;
      break;
    default:
      return NextResponse.json({ error: 'Jenis dokumen tidak dikenali.' }, { status: 400 });
  }

  await supabase.from('downloads').insert({
    user_id: user.id, tool_type: 'ai-generated', file_name: fileName,
    metadata: { prompt, summary: aiResult.summary, toolType: aiResult.toolType },
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'X-AI-Summary': encodeURIComponent(aiResult.summary),
      'X-AI-Tool-Type': aiResult.toolType,
    },
  });
}
