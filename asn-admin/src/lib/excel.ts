import ExcelJS from 'exceljs';
import { AsnFormData } from '@/types';

export async function generateAsnExcel(data: AsnFormData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SIASN Admin';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Data ASN', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true },
  });

  sheet.columns = [
    { key: 'col_a', width: 5 },
    { key: 'col_b', width: 30 },
    { key: 'col_c', width: 22 },
    { key: 'col_d', width: 18 },
    { key: 'col_e', width: 30 },
  ];

  // ── Header block ──────────────────────────────────────────────────────────
  sheet.mergeCells('A1:E1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'PEMERINTAH REPUBLIK INDONESIA';
  titleCell.font = { name: 'Arial', bold: true, size: 13, color: { argb: 'FF1E3A8A' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 24;

  sheet.mergeCells('A2:E2');
  const subtitleCell = sheet.getCell('A2');
  subtitleCell.value = 'SISTEM INFORMASI APARATUR SIPIL NEGARA (SIASN)';
  subtitleCell.font = { name: 'Arial', bold: true, size: 11, color: { argb: 'FF1E3A8A' } };
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(2).height = 22;

  sheet.mergeCells('A3:E3');
  sheet.getRow(3).height = 8;

  // divider
  const divRow = sheet.getRow(4);
  sheet.mergeCells('A4:E4');
  const divCell = sheet.getCell('A4');
  divCell.value = '─'.repeat(80);
  divCell.font = { color: { argb: 'FF1D4ED8' } };
  divCell.alignment = { horizontal: 'center' };
  divRow.height = 10;

  // ── Document title ────────────────────────────────────────────────────────
  sheet.mergeCells('A5:E5');
  const docTitleCell = sheet.getCell('A5');
  docTitleCell.value = 'FORMULIR DATA APARATUR SIPIL NEGARA';
  docTitleCell.font = { name: 'Arial', bold: true, size: 12, color: { argb: 'FF1E3A8A' } };
  docTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(5).height = 28;

  sheet.mergeCells('A6:E6');
  sheet.getRow(6).height = 8;

  // ── Data section ──────────────────────────────────────────────────────────
  const LABEL_STYLE: Partial<ExcelJS.Style> = {
    font: { name: 'Arial', bold: true, size: 10, color: { argb: 'FF1E40AF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } },
    alignment: { vertical: 'middle', horizontal: 'left', indent: 1 },
    border: {
      top: { style: 'thin', color: { argb: 'FF93C5FD' } },
      left: { style: 'thin', color: { argb: 'FF93C5FD' } },
      bottom: { style: 'thin', color: { argb: 'FF93C5FD' } },
      right: { style: 'thin', color: { argb: 'FF93C5FD' } },
    },
  };

  const VALUE_STYLE: Partial<ExcelJS.Style> = {
    font: { name: 'Arial', size: 10 },
    alignment: { vertical: 'middle', horizontal: 'left', indent: 1 },
    border: {
      top: { style: 'thin', color: { argb: 'FF93C5FD' } },
      left: { style: 'thin', color: { argb: 'FF93C5FD' } },
      bottom: { style: 'thin', color: { argb: 'FF93C5FD' } },
      right: { style: 'thin', color: { argb: 'FF93C5FD' } },
    },
  };

  const fields: [string, string][] = [
    ['Nama Lengkap', data.nama],
    ['NIP', data.nip],
    ['Tanggal', data.tanggal],
    ['Instansi', data.instansi],
  ];

  let rowIdx = 7;
  for (const [label, value] of fields) {
    sheet.mergeCells(`A${rowIdx}:B${rowIdx}`);
    sheet.mergeCells(`C${rowIdx}:E${rowIdx}`);

    const labelCell = sheet.getCell(`A${rowIdx}`);
    labelCell.value = label;
    Object.assign(labelCell, LABEL_STYLE);

    const valueCell = sheet.getCell(`C${rowIdx}`);
    valueCell.value = value;
    Object.assign(valueCell, VALUE_STYLE);

    sheet.getRow(rowIdx).height = 24;
    rowIdx++;
  }

  // ── Table header ──────────────────────────────────────────────────────────
  rowIdx++;
  sheet.mergeCells(`A${rowIdx}:E${rowIdx}`);
  const tableTitle = sheet.getCell(`A${rowIdx}`);
  tableTitle.value = 'REKAP DATA';
  tableTitle.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
  tableTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
  tableTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(rowIdx).height = 22;
  rowIdx++;

  const TABLE_HEADER_STYLE: Partial<ExcelJS.Style> = {
    font: { name: 'Arial', bold: true, size: 9, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    border: {
      top: { style: 'thin', color: { argb: 'FFBFDBFE' } },
      left: { style: 'thin', color: { argb: 'FFBFDBFE' } },
      bottom: { style: 'thin', color: { argb: 'FFBFDBFE' } },
      right: { style: 'thin', color: { argb: 'FFBFDBFE' } },
    },
  };

  const headers = ['No', 'Nama Lengkap', 'NIP', 'Tanggal', 'Instansi'];
  const headerRow = sheet.getRow(rowIdx);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    Object.assign(cell, TABLE_HEADER_STYLE);
  });
  headerRow.height = 22;
  rowIdx++;

  // sample data row
  const DATA_ROW_STYLE: Partial<ExcelJS.Style> = {
    font: { name: 'Arial', size: 9 },
    alignment: { vertical: 'middle', horizontal: 'left', indent: 1 },
    border: {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    },
  };

  const dataRow = sheet.getRow(rowIdx);
  const rowValues = ['1', data.nama, data.nip, data.tanggal, data.instansi];
  rowValues.forEach((val, i) => {
    const cell = dataRow.getCell(i + 1);
    cell.value = val;
    Object.assign(cell, DATA_ROW_STYLE);
    if (i === 0) cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  dataRow.height = 22;
  rowIdx += 3;

  // ── Footer ────────────────────────────────────────────────────────────────
  const today = new Date().toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  sheet.mergeCells(`C${rowIdx}:E${rowIdx}`);
  sheet.getCell(`C${rowIdx}`).value = `Jakarta, ${today}`;
  sheet.getCell(`C${rowIdx}`).alignment = { horizontal: 'center' };
  sheet.getCell(`C${rowIdx}`).font = { name: 'Arial', size: 9 };
  rowIdx++;

  sheet.mergeCells(`C${rowIdx}:E${rowIdx}`);
  sheet.getCell(`C${rowIdx}`).value = 'Pejabat yang Berwenang,';
  sheet.getCell(`C${rowIdx}`).alignment = { horizontal: 'center' };
  sheet.getCell(`C${rowIdx}`).font = { name: 'Arial', size: 9 };
  rowIdx += 4;

  sheet.mergeCells(`C${rowIdx}:E${rowIdx}`);
  sheet.getCell(`C${rowIdx}`).value = '(_____________________________)';
  sheet.getCell(`C${rowIdx}`).alignment = { horizontal: 'center' };
  sheet.getCell(`C${rowIdx}`).font = { name: 'Arial', size: 9, underline: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
