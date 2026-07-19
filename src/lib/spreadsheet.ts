import * as XLSX from 'xlsx';
import { C2S_KEYS, C2S_LABELS, C2SRow } from './schema';
import { rowsToMatrix } from './normalize';

/** Le um arquivo binario (XLS/XLSX/CSV) e retorna matriz raw. */
export async function readSpreadsheetToMatrix(file: File): Promise<string[][]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', raw: false, cellDates: false });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  const aoa: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: '',
    blankrows: true,
    raw: false,
  }) as unknown[][];
  return aoa.map((row) => (row ?? []).map((c) => (c === null || c === undefined ? '' : String(c))));
}

/** Gera XLSX a partir de linhas C2SRow e dispara download no navegador. */
export function downloadRowsAsXLSX(rows: C2SRow[], filename = 'leadsheet_saida.xlsx') {
  const matrix = rowsToMatrix(rows);
  const ws = XLSX.utils.aoa_to_sheet(matrix);
  ws['!cols'] = C2S_KEYS.map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Leads');
  XLSX.writeFile(wb, filename, { bookType: 'xlsx', compression: true });
}

/** Gera CSV a partir de linhas C2SRow e dispara download no navegador. */
export function downloadRowsAsCSV(rows: C2SRow[], filename = 'leadsheet_saida.csv') {
  const matrix = rowsToMatrix(rows);
  const ws = XLSX.utils.aoa_to_sheet(matrix);
  const csv = XLSX.utils.sheet_to_csv(ws, { FS: ',', RS: '\r\n' });
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  triggerBlobDownload(blob, filename);
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Gera matriz raw C2S a partir de lista de objetos (usado na revisao manual). */
export function objectsToMatrix(headers: string[] = C2S_LABELS, rows: Record<string, string>[]): string[][] {
  return [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ''))];
}
