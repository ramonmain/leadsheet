'use client';

import React, { useState } from 'react';
import { C2SRow } from '@/lib/schema';
import { downloadRowsAsXLSX } from '@/lib/spreadsheet';

/**
 * Botão de download: apenas XLSX.
 *
 * CSV foi removido como saída porque o Excel em português abre CSV com `,`
 * como separador colocando tudo numa coluna só — gerando confusão manual.
 * XLSX é estruturado e não tem essa ambiguidade. (CSV segue aceito na entrada
 * do fluxo de validação, sem mudanças.)
 *
 * Reaproveita `downloadRowsAsXLSX` de `spreadsheet.ts`.
 */
export function DownloadButtons({
  rows,
  baseName = 'leadsheet_saida',
}: {
  rows: C2SRow[];
  baseName?: string;
}) {
  const [done, setDone] = useState(false);
  const disabled = rows.length === 0;

  function handleDownload() {
    downloadRowsAsXLSX(rows, `${baseName}.xlsx`);
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleDownload}
      className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <DownloadIcon />
      {done ? 'Baixado!' : 'Baixar XLSX'}
    </button>
  );
}

function DownloadIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
