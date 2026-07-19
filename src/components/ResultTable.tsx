'use client';

import React, { useState } from 'react';
import { C2S_LABELS } from '@/lib/schema';
import { C2SRow } from '@/lib/schema';

const COL_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

/**
 * Preview tabular das linhas já padronizadas (A→J).
 * Header sticky, realça a coluna "Mensagem" (H), para onde vão os extras.
 * Paginação simples (primeiras 50 linhas por página) para não travar em bases grandes.
 */
export function ResultTable({ rows }: { rows: C2SRow[] }) {
  const PAGE = 50;
  const [page, setPage] = useState(0);
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        Nenhuma linha válida para exibir.
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE));
  const cur = Math.min(page, totalPages - 1);
  const slice = rows.slice(cur * PAGE, cur * PAGE + PAGE);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="max-h-[28rem] overflow-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-100 dark:bg-slate-800">
              <th className="sticky left-0 z-20 w-10 border-b border-slate-200 bg-slate-100 px-2 py-2 text-left text-xs font-semibold text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500">
                #
              </th>
              {C2S_LABELS.map((label, i) => (
                <th
                  key={label}
                  className={[
                    'whitespace-nowrap border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold dark:border-slate-700',
                    i === 7
                      ? 'bg-brand-50 text-brand-800 dark:bg-brand-950/40 dark:text-brand-300'
                      : 'text-slate-600 dark:text-slate-300',
                  ].join(' ')}
                >
                  <span className="mr-1 font-mono text-[10px] text-slate-400 dark:text-slate-500">{COL_LETTERS[i]}</span>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((row, idx) => {
              const absolute = cur * PAGE + idx;
              return (
                <tr
                  key={absolute}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70 dark:border-slate-800 dark:hover:bg-slate-800/40"
                >
                  <td className="sticky left-0 z-10 w-10 bg-white px-2 py-1.5 text-xs text-slate-400 dark:bg-slate-900 dark:text-slate-500">
                    {absolute + 1}
                  </td>
                  {C2S_LABELS.map((_, i) => {
                    const key = ['nome','email','telefone','produto','valor','data','usuario','mensagem','codigo','origem'][i];
                    const val = ((row as unknown) as Record<string, string>)[key] ?? '';
                    return (
                      <td
                        key={i}
                        className={[
                          'max-w-[16rem] truncate px-3 py-1.5 align-top',
                          i === 7 ? 'bg-brand-50/50 text-slate-700 dark:bg-brand-950/20 dark:text-slate-200' : 'text-slate-700 dark:text-slate-200',
                        ].join(' ')}
                        title={val}
                      >
                        {val || <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          <span>
            Linhas {cur * PAGE + 1}–{Math.min((cur + 1) * PAGE, rows.length)} de {rows.length}
          </span>
          <span className="flex gap-1">
            <PageBtn disabled={cur === 0} onClick={() => setPage(cur - 1)}>Anterior</PageBtn>
            <PageBtn disabled={cur >= totalPages - 1} onClick={() => setPage(cur + 1)}>Próxima</PageBtn>
          </span>
        </div>
      )}
    </div>
  );
}

function PageBtn({
  disabled,
  onClick,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border border-slate-200 bg-white px-2 py-1 font-medium text-slate-600 transition enabled:hover:border-brand-300 enabled:hover:text-brand-700 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
    >
      {children}
    </button>
  );
}
