import ExcelJS from 'exceljs';
import type { FormASNData } from '@/types';
import { addDocumentHeader, labelStyle, valueStyle, COLORS, fullBorder } from './styles';

export async function generateFormASN(data: FormASNData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ASNFlow';
  wb.created = new Date();

  const ws = wb.addWorksheet('Formulir ASN', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, margins: { left: 1.5, right: 1.5, top: 2, bottom: 2, header: 0.5, footer: 0.5 } },
  });

  ws.columns = [
    { key: 'a', width: 5 },
    { key: 'b', width: 28 },
    { key: 'c', width: 5 },
    { key: 'd', width: 32 },
  ];

  let r = addDocumentHeader(ws, 4, 'FORMULIR DATA APARATUR SIPIL NEGARA');
  ws.getRow(r).height = 8; r++;

  const fields: [string, string][] = [
    ['Nama Lengkap', data.nama],
    ['Nomor Induk Pegawai (NIP)', data.nip],
    ['Jabatan', data.jabatan],
    ['Golongan / Ruang', data.golongan],
    ['Unit Kerja', data.unitKerja],
    ['Instansi', data.instansi],
    ['Tanggal', new Date(data.tanggal).toLocaleDateString('id-ID', { dateStyle: 'long' })],
  ];

  for (const [label, value] of fields) {
    ws.mergeCells(`A${r}:B${r}`);
    ws.mergeCells(`C${r}:D${r}`);
    const lCell = ws.getCell(`A${r}`);
    const vCell = ws.getCell(`C${r}`);
    lCell.value = label;
    vCell.value = value;
    Object.assign(lCell, labelStyle);
    Object.assign(vCell, valueStyle);
    ws.getRow(r).height = 24;
    r++;
  }

  r++;
  // Status box
  ws.mergeCells(`A${r}:D${r}`);
  const statusCell = ws.getCell(`A${r}`);
  statusCell.value = 'DATA TELAH DIVERIFIKASI DAN SESUAI DENGAN DOKUMEN ASLI';
  statusCell.font = { name: 'Arial', bold: true, size: 9, color: { argb: COLORS.successText } };
  statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.successBg } };
  statusCell.alignment = { horizontal: 'center', vertical: 'middle' };
  statusCell.border = fullBorder('FF86EFAC');
  ws.getRow(r).height = 22;
  r += 3;

  // Signature block
  const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  ws.mergeCells(`C${r}:D${r}`);
  ws.getCell(`C${r}`).value = `Jakarta, ${today}`;
  ws.getCell(`C${r}`).alignment = { horizontal: 'center' };
  ws.getCell(`C${r}`).font = { name: 'Arial', size: 9 };
  r++;
  ws.mergeCells(`C${r}:D${r}`);
  ws.getCell(`C${r}`).value = 'Pejabat Pengelola Kepegawaian,';
  ws.getCell(`C${r}`).alignment = { horizontal: 'center' };
  ws.getCell(`C${r}`).font = { name: 'Arial', size: 9 };
  r += 4;
  ws.mergeCells(`C${r}:D${r}`);
  ws.getCell(`C${r}`).value = '(__________________________________)';
  ws.getCell(`C${r}`).alignment = { horizontal: 'center' };
  ws.getCell(`C${r}`).font = { name: 'Arial', size: 9 };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
