import { NextRequest, NextResponse } from 'next/server';
import { generateAsnExcel } from '@/lib/excel';
import { AsnFormData } from '@/types';

export async function POST(req: NextRequest) {
  let body: AsnFormData;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { nama, nip, tanggal, instansi } = body;

  if (!nama || !nip || !tanggal || !instansi) {
    return NextResponse.json({ error: 'Semua field wajib diisi.' }, { status: 422 });
  }

  if (!/^\d{18}$/.test(nip)) {
    return NextResponse.json({ error: 'NIP harus 18 digit angka.' }, { status: 422 });
  }

  try {
    const buffer = await generateAsnExcel({ nama, nip, tanggal, instansi });

    const filename = `Data_ASN_${nip}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (err) {
    console.error('Excel generation error:', err);
    return NextResponse.json({ error: 'Gagal membuat file Excel.' }, { status: 500 });
  }
}
