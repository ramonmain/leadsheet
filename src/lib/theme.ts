/**
 * Gerenciamento de tema (claro / escuro / sistema) puramente client-side.
 *
 * O script anti-flash fica injetado diretamente no <head> (ver layout.tsx),
 * garantindo que a classe `dark` seja aplicada ANTES do paint — sem isso
 * o usuario vera um flash do tema errado na primeira renderizacao.
 */

export type ThemePreference = 'light' | 'dark' | 'system';

export const STORAGE_KEY = 'c2s-theme';

export function getStoredTheme(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v === 'light' || v === 'dark' || v === 'system') return v;
  return 'system';
}

export function getEffectiveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'system') {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return pref;
}

export function applyTheme(pref: ThemePreference) {
  if (typeof document === 'undefined') return;
  const eff = getEffectiveTheme(pref);
  document.documentElement.classList.toggle('dark', eff === 'dark');
  document.documentElement.style.colorScheme = eff;
}

/**
 * String do script anti-flash, injetada inline no <head>.
 * Roda antes do React montar, evita flash (FOUC).
 */
export function buildThemeNoFlashScript(): string {
  return `(function(){try{var k=${JSON.stringify(STORAGE_KEY)};var s=localStorage.getItem(k)||'system';var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var eff=s==='dark'||(s==='system'&&d);var c=document.documentElement.classList;if(eff)c.add('dark');else c.remove('dark');document.documentElement.style.colorScheme=eff?'dark':'light';}catch(e){}})();`;
}
