/** Quotes a value for CSV and stops spreadsheet apps from running it as a formula. */
export function csvCell(value: string | number): string {
  const text = String(value);
  const safe = /^[=+\-@\t\r]/.test(text) && typeof value !== 'number' ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function downloadCsv(fileName: string, rows: (string | number)[][]) {
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
