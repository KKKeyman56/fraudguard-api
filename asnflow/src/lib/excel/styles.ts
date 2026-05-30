import type ExcelJS from 'exceljs';

export const COLORS = {
  headerBg: 'FF1E3A8A',
  headerText: 'FFFFFFFF',
  subHeaderBg: 'FF2563EB',
  subHeaderText: 'FFFFFFFF',
  tableBg: 'FF1D4ED8',
  tableAlt: 'FFF0F5FF',
  labelBg: 'FFDBEAFE',
  labelText: 'FF1E40AF',
  borderColor: 'FF93C5FD',
  lightBorder: 'FFD1D5DB',
  successBg: 'FFF0FDF4',
  successText: 'FF166534',
  warningBg: 'FFFEFCE8',
  warningText: 'FF854D0E',
  dangerBg: 'FFFEF2F2',
  dangerText: 'FFB91C1C',
  white: 'FFFFFFFF',
};

export const thinBorder = (color = COLORS.borderColor): Partial<ExcelJS.Border> => ({
  style: 'thin',
  color: { argb: color },
});

export const fullBorder = (color = COLORS.borderColor): Partial<ExcelJS.Borders> => ({
  top: thinBorder(color),
  left: thinBorder(color),
  bottom: thinBorder(color),
  right: thinBorder(color),
});

export const headerFont = (size = 11): Partial<ExcelJS.Font> => ({
  name: 'Arial',
  bold: true,
  size,
  color: { argb: COLORS.headerText },
});

export const labelStyle: Partial<ExcelJS.Style> = {
  font: { name: 'Arial', bold: true, size: 10, color: { argb: COLORS.labelText } },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.labelBg } },
  alignment: { vertical: 'middle', horizontal: 'left', indent: 1 },
  border: fullBorder(),
};

export const valueStyle: Partial<ExcelJS.Style> = {
  font: { name: 'Arial', size: 10 },
  alignment: { vertical: 'middle', horizontal: 'left', indent: 1 },
  border: fullBorder(),
};

export function applyHeaderRow(row: ExcelJS.Row, bg = COLORS.tableBg, fg = COLORS.headerText) {
  row.eachCell({ includeEmpty: false }, (cell) => {
    cell.font = { name: 'Arial', bold: true, size: 9, color: { argb: fg } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = fullBorder('FFBFDBFE');
  });
  row.height = 22;
}

export function applyDataRow(row: ExcelJS.Row, isAlt = false) {
  const bg = isAlt ? COLORS.tableAlt : COLORS.white;
  row.eachCell({ includeEmpty: true }, (cell) => {
    if (!cell.font?.bold) {
      cell.font = { name: 'Arial', size: 9 };
    }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    cell.alignment = { vertical: 'middle', wrapText: false };
    cell.border = fullBorder(COLORS.lightBorder);
  });
  row.height = 20;
}

export function addDocumentHeader(sheet: ExcelJS.Worksheet, numCols: number, title: string, subtitle?: string) {
  const mergeTo = String.fromCharCode(64 + numCols);

  sheet.mergeCells(`A1:${mergeTo}1`);
  const row1 = sheet.getCell('A1');
  row1.value = 'PEMERINTAH REPUBLIK INDONESIA';
  row1.font = { name: 'Arial', bold: true, size: 13, color: { argb: COLORS.headerBg } };
  row1.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 24;

  sheet.mergeCells(`A2:${mergeTo}2`);
  const row2 = sheet.getCell('A2');
  row2.value = 'SISTEM INFORMASI APARATUR SIPIL NEGARA (SIASN)';
  row2.font = { name: 'Arial', bold: true, size: 10, color: { argb: COLORS.subHeaderBg } };
  row2.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(2).height = 18;

  sheet.mergeCells(`A3:${mergeTo}3`);
  const row3 = sheet.getCell('A3');
  row3.value = '─'.repeat(100);
  row3.font = { color: { argb: COLORS.subHeaderBg } };
  row3.alignment = { horizontal: 'center' };
  sheet.getRow(3).height = 8;

  sheet.mergeCells(`A4:${mergeTo}4`);
  const row4 = sheet.getCell('A4');
  row4.value = title;
  row4.font = { name: 'Arial', bold: true, size: 12, color: { argb: COLORS.headerBg } };
  row4.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(4).height = 28;

  if (subtitle) {
    sheet.mergeCells(`A5:${mergeTo}5`);
    const row5 = sheet.getCell('A5');
    row5.value = subtitle;
    row5.font = { name: 'Arial', size: 10, color: { argb: 'FF374151' } };
    row5.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(5).height = 18;
    return 6;
  }
  return 5;
}
