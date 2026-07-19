'use client';

import React from 'react';
import { NormalizeResult } from '@/lib/normalize';
import { Severity } from '@/lib/normalize';

/** Para qual filtro de relatório cada card leva. `null` = não clicável. */
type CardTarget = Severity | 'all' | null;

interface StatBadgesProps {
  stats: NormalizeResult['stats'];
  /** Chamado quando o usuário clica num card que tem alvo. */
  onFocusRequest?: (target: Exclude<CardTarget, null>) => void;
}

/**
 * Faixas de resumo com os números-chave da normalização.
 * Válido / Inválido / Corrigido / Total.
 *
 * Cada card (exceto "Linhas válidas", que é só informativa) é clicável e
 * dispara `onFocusRequest` para abrir/rolar até a seção correspondente do
 * relatório abaixo.
 */
export function StatBadges({ stats, onFocusRequest }: StatBadgesProps) {
  const items: {
    label: string;
    value: number;
    tone: 'ok' | 'bad' | 'fix' | 'muted';
    target: CardTarget;
  }[] = [
    { label: 'Linhas válidas', value: stats.validRows, tone: 'ok', target: null },
    {
      label: 'Inválidas',
      value: stats.invalidRows,
      tone: stats.invalidRows > 0 ? 'bad' : 'muted',
      target: 'error',
    },
    {
      label: 'Corrigido',
      value: (stats.reordered ? 1 : 0) + stats.extrasMoved,
      tone: stats.reordered || stats.extrasMoved ? 'fix' : 'muted',
      target: 'fix',
    },
    { label: 'Total lido', value: stats.totalRows, tone: 'muted', target: 'all' },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((it) => {
        const clickable = it.target !== null && onFocusRequest !== undefined;
        return (
          <button
            key={it.label}
            type="button"
            disabled={!clickable}
            onClick={() => clickable && onFocusRequest?.(it.target as Exclude<CardTarget, null>)}
            className={[
              'rounded-xl border px-3 py-2 text-left transition',
              toneClasses(it.tone),
              clickable
                ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-soft focus:outline-none focus:ring-2 focus:ring-brand-300'
                : 'cursor-default',
            ].join(' ')}
            aria-label={
              clickable ? `${it.label}: ${it.value} — ver no relatório` : `${it.label}: ${it.value}`
            }
          >
            <div className="flex items-baseline justify-between">
              <div className="text-lg font-semibold leading-tight tabular-nums">{it.value}</div>
              {clickable && (
                <svg className="h-3.5 w-3.5 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              )}
            </div>
            <div className="text-xs">{it.label}</div>
          </button>
        );
      })}
    </div>
  );
}

function toneClasses(tone: 'ok' | 'bad' | 'fix' | 'muted'): string {
  switch (tone) {
    case 'ok':
      return 'border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-900 dark:bg-brand-950/50 dark:text-brand-300';
    case 'bad':
      return 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300';
    case 'fix':
      return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300';
  }
}
