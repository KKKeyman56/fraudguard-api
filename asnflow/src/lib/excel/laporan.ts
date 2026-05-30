import ExcelJS from 'exceljs';
import type { LaporanData } from '@/types';
import { addDocumentHeader, applyHeaderRow, applyDataRow, labelStyle, valueStyle, COLORS, fullBorder } from './styles';

export async function generateLaporan(data: LaporanData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ASNFlow';

  const ws = wb.addWorksheet('Laporan Bulanan', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true },
  });

  ws.columns = [
    { key: 'no', width: 5 },
    { key: 'kegiatan', width: 30 },
    { key: 'tanggal', width: 16 },
    { key: 'tempat', width: 22 },
    { key: 'peserta', width: 22 },
    { key: 'pelaksana', width: 22 },
    { key: 'hasil', width: 32 },
    { key: 'keterangan', width: 18 },
  ];

  const r0 = addDocumentHeader(ws, 8, 'LAPORAN KEGIATAN BULANAN', `${data.instansi} | ${data.unitKerja} | ${data.bulan} ${data.tahun}`);

  let r = r0;
  for (const [label, val] of [['Instansi', data.instansi], ['Unit Kerja', data.unitKerja], ['Periode', `${data.bulan} ${data.tahun}`]] as [string,string][]) {
    ws.mergeCells(`A${r}:D${r}`); ws.mergeCells(`E${r}:H${r}`);
    const lc = ws.getCell(`A${r}`); const vc = ws.getCell(`E${r}`);
    lc.value = label; Object.assign(lc, labelStyle);
    vc.value = val; Object.assign(vc, valueStyle);
    ws.getRow(r).height = 22; r++;
  }
  r++;

  ws.mergeCells(`A${r}:H${r}`);
  const sc = ws.getCell(`A${r}`);
  sc.value = 'DAFTAR KEGIATAN';
  sc.font = { name: 'Arial', bold: true, size: 10, color: { argb: COLORS.headerText } };
  sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.tableBg } };
  sc.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(r).height = 22; r++;

  const thr = ws.getRow(r);
  ['No', 'Nama Kegiatan', 'Tanggal', 'Tempat', 'Peserta', 'Pelaksana', 'Hasil / Output', 'Keterangan']
    .forEach((h, i) => { thr.getCell(i + 1).value = h; });
  applyHeaderRow(thr); r++;

  data.kegiatan.forEach((k, idx) => {
    const dr = ws.getRow(r);
    [idx + 1, k.namaKegiatan,
     new Date(k.tanggal).toLocaleDateString('id-ID'),
     k.tempat, k.peserta, k.pelaksana, k.hasil, k.keterangan ?? '']
      .forEach((v, i) => { dr.getCell(i + 1).value = v; });
    applyDataRow(dr, idx % 2 === 1);
    dr.height = 24;
    r++;
  });

  r++;
  // Summary stats
  ws.mergeCells(`A${r}:H${r}`);
  const statCell = ws.getCell(`A${r}`);
  statCell.value = `Total Kegiatan: ${data.kegiatan.length} | Periode: ${data.bulan} ${data.tahun}`;
  statCell.font = { name: 'Arial', bold: true, size: 9, color: { argb: COLORS.labelText } };
  statCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.labelBg } };
  statCell.alignment = { horizontal: 'center', vertical: 'middle' };
  statCell.border = fullBorder();
  ws.getRow(r).height = 20;
  r += 3;

  const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  ws.mergeCells(`E${r}:H${r}`);
  ws.getCell(`E${r}`).value = `Jakarta, ${today}`;
  ws.getCell(`E${r}`).alignment = { horizontal: 'center' };
  ws.getCell(`E${r}`).font = { name: 'Arial', size: 9 };
  r++;
  ws.mergeCells(`E${r}:H${r}`);
  ws.getCell(`E${r}`).value = 'Kepala Unit Kerja,';
  ws.getCell(`E${r}`).alignment = { horizontal: 'center' };
  ws.getCell(`E${r}`).font = { name: 'Arial', size: 9 };
  r += 4;
  ws.mergeCells(`E${r}:H${r}`);
  ws.getCell(`E${r}`).value = '(__________________________________)';
  ws.getCell(`E${r}`).alignment = { horizontal: 'center' };
  ws.getCell(`E${r}`).font = { name: 'Arial', size: 9 };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
