import ExcelJS from 'exceljs';
import type { AbsensiData } from '@/types';
import { addDocumentHeader, applyHeaderRow, applyDataRow, labelStyle, valueStyle, COLORS, fullBorder } from './styles';

export async function generateAbsensi(data: AbsensiData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ASNFlow';

  // ── Sheet 1: Rekap ───────────────────────────────────────────────────────
  const ws = wb.addWorksheet('Rekap Absensi', { pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true } });

  ws.columns = [
    { key: 'no', width: 5 },
    { key: 'nama', width: 28 },
    { key: 'nip', width: 22 },
    { key: 'jabatan', width: 22 },
    { key: 'hadir', width: 10 },
    { key: 'sakit', width: 10 },
    { key: 'izin', width: 10 },
    { key: 'alpha', width: 10 },
    { key: 'total', width: 12 },
    { key: 'persen', width: 14 },
  ];

  const r0 = addDocumentHeader(ws, 10, 'REKAPITULASI ABSENSI PEGAWAI', `${data.instansi} | ${data.unitKerja} | ${data.bulan} ${data.tahun}`);

  // Info rows
  let r = r0;
  const infoFields: [string, string][] = [
    ['Instansi', data.instansi],
    ['Unit Kerja', data.unitKerja],
    ['Periode', `${data.bulan} ${data.tahun}`],
  ];
  for (const [label, val] of infoFields) {
    ws.mergeCells(`A${r}:D${r}`);
    ws.mergeCells(`E${r}:J${r}`);
    const lc = ws.getCell(`A${r}`);
    const vc = ws.getCell(`E${r}`);
    lc.value = label; Object.assign(lc, labelStyle);
    vc.value = val; Object.assign(vc, valueStyle);
    ws.getRow(r).height = 22;
    r++;
  }
  r++;

  // Section header
  ws.mergeCells(`A${r}:J${r}`);
  const secCell = ws.getCell(`A${r}`);
  secCell.value = 'DAFTAR REKAPITULASI';
  secCell.font = { name: 'Arial', bold: true, size: 10, color: { argb: COLORS.headerText } };
  secCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.tableBg } };
  secCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(r).height = 22;
  r++;

  // Table header
  const thr = ws.getRow(r);
  const headers = ['No', 'Nama Lengkap', 'NIP', 'Jabatan', 'Hadir', 'Sakit', 'Izin', 'Alpha', 'Total Hari', '% Kehadiran'];
  headers.forEach((h, i) => { thr.getCell(i + 1).value = h; });
  applyHeaderRow(thr);
  r++;

  let totalHadir = 0, totalSakit = 0, totalIzin = 0, totalAlpha = 0;

  data.pegawai.forEach((p, idx) => {
    const totalHari = p.hadir + p.sakit + p.izin + p.alpha;
    const persen = totalHari > 0 ? ((p.hadir / totalHari) * 100).toFixed(1) + '%' : '0%';
    const dr = ws.getRow(r);
    [idx + 1, p.nama, p.nip, p.jabatan, p.hadir, p.sakit, p.izin, p.alpha, totalHari, persen]
      .forEach((v, i) => { dr.getCell(i + 1).value = v; });
    applyDataRow(dr, idx % 2 === 1);
    totalHadir += p.hadir; totalSakit += p.sakit; totalIzin += p.izin; totalAlpha += p.alpha;
    r++;
  });

  // Summary row
  const sr = ws.getRow(r);
  const totalHariAll = totalHadir + totalSakit + totalIzin + totalAlpha;
  const avgPersen = totalHariAll > 0 ? ((totalHadir / totalHariAll) * 100).toFixed(1) + '%' : '0%';
  ws.mergeCells(`A${r}:D${r}`);
  sr.getCell(1).value = 'TOTAL';
  [totalHadir, totalSakit, totalIzin, totalAlpha, totalHariAll, avgPersen]
    .forEach((v, i) => { sr.getCell(5 + i).value = v; });
  sr.eachCell({ includeEmpty: false }, (cell) => {
    cell.font = { name: 'Arial', bold: true, size: 9 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.labelBg } };
    cell.border = fullBorder();
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  sr.height = 22;

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
