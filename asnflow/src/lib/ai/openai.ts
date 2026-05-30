import OpenAI from 'openai';
import type { FormASNData, AbsensiData, LaporanData, ArsipSuratExportData, ToolType } from '@/types';

function getClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
}

const SYSTEM_PROMPT = `Kamu adalah asisten administrasi ASN Indonesia yang ahli.
Berdasarkan perintah pengguna, tentukan jenis dokumen yang perlu dibuat dan hasilkan data terstruktur.

Jenis dokumen yang tersedia:
- form-asn: Formulir data pegawai ASN
- absensi: Rekap absensi bulanan
- laporan: Laporan kegiatan bulanan
- arsip-surat: Arsip surat masuk/keluar

Selalu balas dalam format JSON valid.
Gunakan bahasa Indonesia yang formal dan profesional.
Isi data dengan nilai yang masuk akal untuk konteks pemerintahan Indonesia.`;

export async function generateExcelData(prompt: string): Promise<{
  toolType: ToolType;
  data: FormASNData | AbsensiData | LaporanData | ArsipSuratExportData;
  summary: string;
}> {
  const completion = await getClient().chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Perintah: "${prompt}"

Balas dengan JSON berikut:
{
  "toolType": "<form-asn|absensi|laporan|arsip-surat>",
  "summary": "<ringkasan singkat apa yang dibuat>",
  "data": { ... data lengkap sesuai toolType ... }
}

Untuk laporan, data harus berupa:
{
  "instansi": "...",
  "unitKerja": "...",
  "bulan": "...",
  "tahun": "...",
  "kegiatan": [
    {
      "namaKegiatan": "...",
      "tanggal": "YYYY-MM-DD",
      "tempat": "...",
      "peserta": "...",
      "pelaksana": "...",
      "hasil": "...",
      "keterangan": "..."
    }
  ]
}

Untuk absensi, data harus berupa:
{
  "instansi": "...",
  "unitKerja": "...",
  "bulan": "...",
  "tahun": "...",
  "pegawai": [
    { "nama": "...", "nip": "...", "jabatan": "...", "hadir": 0, "sakit": 0, "izin": 0, "alpha": 0 }
  ]
}`,
      },
    ],
  });

  const raw = completion.choices[0].message.content ?? '{}';
  const parsed = JSON.parse(raw);
  return {
    toolType: parsed.toolType as ToolType,
    data: parsed.data,
    summary: parsed.summary ?? 'Dokumen berhasil dibuat oleh AI.',
  };
}
