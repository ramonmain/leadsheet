import React from 'react';

/**
 * Wordmark do produto: "C2S" em Fraunces (display) + subtítulo.
 * Sem mascote/robô — identidade sóbria de ferramenta de trabalho.
 */
export function Logo() {
  return (
    <div className="flex items-baseline gap-2 select-none">
      <span className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
        C2S
      </span>
      <span className="text-sm font-medium text-brand-600 dark:text-brand-400">
        Padronizador
      </span>
    </div>
  );
}
