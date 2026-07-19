'use client';

import React from 'react';

export type Mode = 'pdf' | 'validate';

interface ModeTabsProps {
  mode: Mode;
  onChange: (m: Mode) => void;
}

/**
 * Alternador entre os dois fluxos do produto.
 * Underline animado em esmeralda (transição CSS simples).
 */
export function ModeTabs({ mode, onChange }: ModeTabsProps) {
  return (
    <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
      <TabButton active={mode === 'pdf'} onClick={() => onChange('pdf')}>
        Converter PDF
      </TabButton>
      <TabButton active={mode === 'validate'} onClick={() => onChange('validate')}>
        Validar planilha
      </TabButton>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'relative rounded-lg px-4 py-2 text-sm font-medium transition',
        active
          ? 'bg-white text-brand-700 shadow-soft dark:bg-slate-900 dark:text-brand-400'
          : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
