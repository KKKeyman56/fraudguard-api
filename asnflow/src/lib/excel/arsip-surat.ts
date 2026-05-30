import ExcelJS from 'exceljs';
import type { ArsipSuratExportData } from '@/types';
import { addDocumentHeader, applyHeaderRow, applyDataRow, labelStyle, valueStyle, COLORS } from './styles';

export async function generateArsipSurat(data: ArsipSuratExportData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ASNFlow';

  for (const jenis of ['masuk', 'keluar'] as const) {
    const filtered = data.items.filter((s) => s.jenis === jenis);
    if (filtered.length === 0) continue;

    const ws = wb.addWorksheet(`Surat ${jenis === 'masuk' ? 'Masuk' : 'Keluar'}`, {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
    });

    ws.columns = [
      { key: 'no', width: 5 },
      { key: 'nomor', width: 22 },
      { key: 'tanggal', width: 16 },
      { key: 'pengirim', width: 28 },
      { key: 'tujuan', width: 28 },
      { key: 'perihal', width: 36 },
      { key: 'keterangan', width: 24 },
    ];

    const judul = jenis === 'masuk' ? 'BUKU AGENDA SURAT MASUK' : 'BUKU AGENDA SURAT KELUAR';
    const r0 = addDocumentHeader(ws, 7, judul, `${data.instansi} | ${data.unitKerja} | ${data.periode}`);

    let r = r0;
    for (const [label, val] of [['Instansi', data.instansi], ['Unit Kerja', data.unitKerja], ['Periode', data.periode]] as [string,string][]) {
      ws.mergeCells(`A${r}:C${r}`); ws.mergeCells(`D${r}:G${r}`);
      const lc = ws.getCell(`A${r}`); const vc = ws.getCell(`D${r}`);
      lc.value = label; Object.assign(lc, labelStyle);
      vc.value = val; Object.assign(vc, valueStyle);
      ws.getRow(r).height = 22; r++;
    }
    r++;

    ws.mergeCells(`A${r}:G${r}`);
    const sc = ws.getCell(`A${r}`);
    sc.value = jenis === 'masuk' ? 'DAFTAR SURAT MASUK' : 'DAFTAR SURAT KELUAR';
    sc.font = { name: 'Arial', bold: true, size: 10, color: { argb: COLORS.headerText } };
    sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.tableBg } };
    sc.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(r).height = 22; r++;

    const thr = ws.getRow(r);
    ['No', 'Nomor Surat', 'Tanggal', 'Pengirim', 'Tujuan', 'Perihal', 'Keterangan']
      .forEach((h, i) => { thr.getCell(i + 1).value = h; });
    applyHeaderRow(thr); r++;

    filtered.forEach((item, idx) => {
      const dr = ws.getRow(r);
      [idx + 1, item.nomor_surat,
       new Date(item.tanggal).toLocaleDateString('id-ID'),
       item.pengirim, item.tujuan, item.perihal, item.keterangan ?? '']
        .forEach((v, i) => { dr.getCell(i + 1).value = v; });
      applyDataRow(dr, idx % 2 === 1);
      r++;
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
