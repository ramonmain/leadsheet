'use client';

import React, { useMemo, useState } from 'react';
import { C2S_COLUMNS, C2SKey } from '@/lib/schema';
import { resolveColumnKey } from '@/lib/normalize';

interface ManualReviewEditorProps {
  matrix: string[][]; // [header, ...rows]
  reason?: string;
  onConfirm: (mapped: { header: string[]; rows: string[][] }) => void;
  onCancel: () => void;
}

/**
 * Editor para o caso ambíguo de PDF: o usuário mapeia cada coluna
 * detectada para um campo C2S (ou "ignorar"/"mensagem") e ajusta valores.
 * Ao confirmar, devolve a matriz já no formato [header, ...rows].
 */
export function ManualReviewEditor({ matrix, reason, onConfirm, onCancel }: ManualReviewEditorProps) {
  const initialHeader = useMemo(() => matrix[0] ?? [], [matrix]);
  const dataRows = useMemo(() => matrix.slice(1), [matrix]);

  // mapping[colIdx] = C2SKey | 'mensagem' | '' (ignorar)
  const [mapping, setMapping] = useState<Record<number, C2SKey | 'mensagem' | ''>>(() => {
    const m: Record<number, C2SKey | 'mensagem' | ''> = {};
    (matrix[0] ?? []).forEach((h, i) => {
      const k = resolveColumnKey(h);
      m[i] = k ?? '';
    });
    return m;
  });

  // valores editáveis (deep copy)
  const [rows, setRows] = useState<string[][]>(() => matrix.slice(1).map((r) => [...r]));

  const preview = useMemo(() => buildPreview(initialHeader, rows, mapping), [initialHeader, rows, mapping]);

  function setCell(r: number, c: number, v: string) {
    setRows((prev) => {
      const next = prev.map((row) => [...row]);
      if (!next[r]) next[r] = [];
      next[r][c] = v;
      return next;
    });
  }

  function confirm() {
    onConfirm(preview);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
        <strong className="font-semibold">Revisão necessária.</strong>{' '}
        {reason ?? 'O PDF não pôde ser lido com confiança. Mapeie cada coluna abaixo.'}
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Mapeamento de colunas
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {initialHeader.map((h, i) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-1 truncate text-xs text-slate-500 dark:text-slate-400" title={h}>
                Coluna {numberToLetter(i)}: <span className="font-medium text-slate-700 dark:text-slate-200">{h || '(sem título)'}</span>
              </div>
              <select
                value={mapping[i] ?? ''}
                onChange={(e) => setMapping((p) => ({ ...p, [i]: e.target.value as C2SKey | 'mensagem' | '' }))}
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:ring-brand-800"
              >
                <option value="">— Ignorar —</option>
                <option value="mensagem">→ Mensagem (concatenar)</option>
                {C2S_COLUMNS.map((c) => (
                  <option key={c.key} value={c.key}>
                    → {c.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      <details className="rounded-xl border border-slate-200 dark:border-slate-700">
        <summary className="cursor-pointer select-none px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300">
          Editar valores ({rows.length} linhas)
        </summary>
        <div className="max-h-80 overflow-auto border-t border-slate-200 dark:border-slate-700">
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800">
              <tr>
                <th className="px-2 py-1 text-left text-slate-400">#</th>
                {initialHeader.map((h, i) => (
                  <th key={i} className="whitespace-nowrap px-2 py-1 text-left font-medium text-slate-600 dark:text-slate-300">
                    {numberToLetter(i)} · {h || '(sem título)'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-2 py-1 text-slate-400">{r + 1}</td>
                  {initialHeader.map((_, c) => (
                    <td key={c} className="px-1 py-1">
                      <input
                        value={row[c] ?? ''}
                        onChange={(e) => setCell(r, c, e.target.value)}
                        className="w-32 min-w-[6rem] rounded border border-transparent bg-transparent px-1 py-0.5 text-slate-700 hover:border-slate-200 focus:border-brand-400 focus:bg-white focus:outline-none dark:text-slate-200 dark:hover:border-slate-700 dark:focus:bg-slate-800"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={confirm}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
        >
          Gerar planilha
        </button>
      </div>
    </div>
  );
}

function numberToLetter(n: number): string {
  return String.fromCharCode(65 + n);
}

/**
 * Constrói a matriz final [header C2S, ...rows] aplicando o mapeamento.
 * Colunas marcadas como 'mensagem' são concatenadas dentro de "Mensagem".
 */
function buildPreview(
  initialHeader: string[],
  rows: string[][],
  mapping: Record<number, C2SKey | 'mensagem' | ''>
): { header: string[]; rows: string[][] } {
  const header = C2S_COLUMNS.map((c) => c.label);
  const keys = C2S_COLUMNS.map((c) => c.key);

  const outRows: string[][] = rows.map((row) => {
    const obj: Record<string, string> = {};
    const msgFrags: string[] = [];
    initialHeader.forEach((h, c) => {
      const target = mapping[c];
      const val = (row[c] ?? '').trim();
      if (!val || !target) return;
      if (target === 'mensagem') {
        msgFrags.push(`${h}: ${val}`);
      } else {
        obj[target] = obj[target] ? `${obj[target]} ${val}`.trim() : val;
      }
    });
    if (msgFrags.length) {
      obj.mensagem = obj.mensagem ? `${obj.mensagem} | ${msgFrags.join(' | ')}` : msgFrags.join(' | ');
    }
    return keys.map((k) => obj[k] ?? '');
  });

  return { header, rows: outRows };
}
