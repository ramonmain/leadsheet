import { C2S_COLUMNS, C2S_KEYS, C2SKey, C2S_LABELS, C2SRow, SYNONYMS } from './schema';

export type Severity = 'error' | 'warning' | 'info' | 'fix';

export interface ReportItem {
  severity: Severity;
  row: number;          // 1-indexed data row (linha 1 = primeira linha de dados)
  column?: string;      // label ou nome da coluna extra
  message: string;      // motivo / descricao
  action?: string;      // o que foi feito automaticamente
}

export interface NormalizeResult {
  rows: C2SRow[];             // linhas validas normalizadas (cabecalho ignorado)
  headers: string[];          // cabecalho final A..J
  report: ReportItem[];
  invalidRows: C2SRow[];      // linhas rejeitadas (sem nome e sem contato)
  stats: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    extrasMoved: number;
    reordered: boolean;
    missingColumns: string[];
  };
}

const norm = (s: unknown): string =>
  s === null || s === undefined ? '' : String(s).trim();

const fold = (s: string): string =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim().toLowerCase();

export function resolveColumnKey(headerLabel: string): C2SKey | null {
  const h = fold(headerLabel);
  if (!h) return null;
  if (SYNONYMS[h]) return SYNONYMS[h];
  for (const k of Object.keys(SYNONYMS) as (keyof typeof SYNONYMS)[]) {
    if (h.includes(k)) return SYNONYMS[k];
  }
  for (const col of C2S_COLUMNS) {
    if (fold(col.label) === h) return col.key;
  }
  return null;
}

/**
 * Versao detalhada de `resolveColumnKey` que retorna o tipo de casamento
 * (exato, singularizado, ou nenhum) — usado pelo detector de colunas do PDF.
 */
export function resolveColumnKeyDetailed(headerLabel: string): {
  key: C2SKey | null;
  matchType: 'exact' | 'singularized' | 'none';
} {
  const h = fold(headerLabel);
  if (!h) return { key: null, matchType: 'none' };
  if (SYNONYMS[h]) return { key: SYNONYMS[h], matchType: 'exact' };
  for (const k of Object.keys(SYNONYMS) as (keyof typeof SYNONYMS)[]) {
    if (h.includes(k)) return { key: SYNONYMS[k], matchType: 'singularized' };
  }
  for (const col of C2S_COLUMNS) {
    if (fold(col.label) === h) return { key: col.key, matchType: 'exact' };
  }
  return { key: null, matchType: 'none' };
}

export function normalizeRawMatrix(raw: string[][]): NormalizeResult {
  const report: ReportItem[] = [];
  if (raw.length === 0) {
    return {
      rows: [], headers: C2S_LABELS,
      report: [{ severity: 'error', row: 0, message: 'Planilha vazia (sem linhas).' }],
      invalidRows: [],
      stats: { totalRows: 0, validRows: 0, invalidRows: 0, extrasMoved: 0, reordered: false, missingColumns: [] },
    };
  }
  const rawHeader = raw[0].map(norm);
  const dataRows = raw.slice(1);
  type Mp = { rawIdx: number; key: C2SKey | null; headerLabel: string };
  const mapping: Mp[] = rawHeader.map((h, i) => ({ rawIdx: i, key: resolveColumnKey(h), headerLabel: h }));

  const expectedOrder = C2S_KEYS.join(',');
  const actualOrder = mapping.filter((m) => m.key !== null).map((m) => m.key!).join(',');
  const reordered = actualOrder !== '' && actualOrder !== expectedOrder;
  if (reordered) {
    report.push({
      severity: 'fix', row: 0,
      message: 'A ordem das colunas foi reordenada para o padrao C2S (A -> J).',
      action: `Original: ${rawHeader.filter(Boolean).join(', ') || '(vazio)'} -> ${C2S_LABELS.join(', ')}`,
    });
  }

  const presentKeys = new Set(mapping.filter((m) => m.key !== null).map((m) => m.key!));
  const missingColumns: string[] = [];
  for (const col of C2S_COLUMNS) if (!presentKeys.has(col.key)) missingColumns.push(col.label);
  for (const label of missingColumns) {
    report.push({
      severity: 'info', row: 0, column: label,
      message: `Coluna "${label}" ausente foi adicionada em branco.`,
      action: 'Coluna criada vazia.',
    });
  }

  const extras = mapping.filter((m) => m.key === null && m.headerLabel !== '');
  let extrasMoved = 0;
  if (extras.length) {
    const nomes = extras.map((e) => `"${e.headerLabel}"`).join(', ');
    report.push({
      severity: 'fix', row: 0,
      message: `${extras.length} coluna(s) extra(s) foram concatenadas dentro do campo "Mensagem".`,
      action: `Colunas: ${nomes}. Nenhum dado descartado.`,
    });
  }

  const rows: C2SRow[] = [];
  const invalidRows: C2SRow[] = [];

  dataRows.forEach((rawRow, idx) => {
    const rowNum = idx + 1;
    if (rawRow.every((c) => norm(c) === '')) return;
    const obj = {} as C2SRow;
    const extrasFragments: string[] = [];
    mapping.forEach(({ rawIdx, key, headerLabel }) => {
      const value = norm(rawRow[rawIdx]);
      if (key === null) {
        if (headerLabel !== '' && value !== '') {
          extrasFragments.push(`${headerLabel}: ${value}`);
          extrasMoved++;
        }
      } else {
        (obj as Record<string, string>)[key] = value;
      }
    });
    if (extrasFragments.length) {
      const cur = norm(obj.mensagem);
      const merged = extrasFragments.join(' | ');
      obj.mensagem = cur ? `${cur} | ${merged}` : merged;
    }
    const nome = norm(obj.nome);
    const email = norm(obj.email);
    const telefone = norm(obj.telefone);
    if (email === '' && telefone === '') {
      if (nome === '') {
        report.push({ severity: 'error', row: rowNum, message: 'Linha invalida: sem Nome e sem E-mail/Telefone. Nao sera importada.' });
        obj.__rowIndex = rowNum;
        invalidRows.push(obj);
        return;
      } else {
        report.push({ severity: 'warning', row: rowNum, column: 'E-mail / Telefone', message: 'Linha tem Nome mas esta sem E-mail e sem Telefone. Importacao aceita, mas pode nao ser contatavel.' });
      }
    }
    if (!nome && (email || telefone)) {
      report.push({ severity: 'warning', row: rowNum, column: 'Nome', message: 'Nome vazio mas a linha tem contato. Importacao aceita; recomendado revisar.' });
    }
    if (!norm(obj.produto)) {
      report.push({ severity: 'warning', row: rowNum, column: 'Produto', message: 'Produto vazio. Obrigatorio no C2S; importacao pode falhar.' });
    }
    obj.__rowIndex = rowNum;
    rows.push(obj);
  });

  return {
    rows, headers: C2S_LABELS, report, invalidRows,
    stats: { totalRows: dataRows.length, validRows: rows.length, invalidRows: invalidRows.length, extrasMoved, reordered, missingColumns },
  };
}

export function rowsToMatrix(rows: C2SRow[]): string[][] {
  const out: string[][] = [C2S_LABELS];
  for (const r of rows) out.push(C2S_KEYS.map((k) => norm((r as Record<string, string>)[k] ?? '')));
  return out;
}
