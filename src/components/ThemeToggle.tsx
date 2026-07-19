'use client';

import React, { useEffect, useState } from 'react';
import {
  ThemePreference,
  applyTheme,
  getStoredTheme,
} from '@/lib/theme';

/**
 * Botão que alterna light -> dark -> system -> light.
 * SVGs inline (sun/moon/auto), sem libs de ícone.
 */
export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePreference>('system');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setPref(getStoredTheme());
    setMounted(true);
  }, []);

  function cycle() {
    const order: ThemePreference[] = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(pref) + 1) % order.length];
    setPref(next);
    try {
      window.localStorage.setItem('c2s-theme', next);
    } catch {
      /* noop */
    }
    applyTheme(next);
  }

  // Evita hidration mismatch: render neutro até montar.
  const icon = !mounted ? <SunIcon /> : pref === 'light' ? <SunIcon /> : pref === 'dark' ? <MoonIcon /> : <AutoIcon />;
  const label = !mounted ? 'Tema' : pref === 'light' ? 'Claro' : pref === 'dark' ? 'Escuro' : 'Sistema';

  return (
    <button
      type="button"
      onClick={cycle}
      title={`Tema: ${label}`}
      aria-label={`Alternar tema (atual: ${label})`}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-brand-700 dark:hover:text-brand-400"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
function AutoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18" />
      <path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none" />
    </svg>
  );
}
