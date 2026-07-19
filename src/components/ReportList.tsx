'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ReportItem, Severity } from '@/lib/normalize';

const ORDER: Severity[] = ['error', 'fix', 'warning', 'info'];
const LABELS: Record<Severity, string> = {
  error: 'Erros',
  fix: 'Corrigido automaticamente',
  warning: 'Avisos',
  info: 'Informações',
};

/** Quantos itens uma seção pode ter antes de vir recolhida por padrão. */
const COLLAPSE_THRESHOLD = 5;

export interface ReportListFocusRequest {
  severity: Severity;
  nonce: number; // muda a cada solicitacao para disparar o efeito mesmo p/ mesma sev
}

interface ReportListProps {
  items: ReportItem[];
  /** Filtro controlado externamente (ex.: clique nos cards de estatística). */
  activeFilter?: Severity | 'all';
  onFilterChange?: (f: Severity | 'all') => void;
  /** Sinal para expandir uma seção e rolar até ela (vindo dos cards, p.ex.). */
  focusRequest?: ReportListFocusRequest | null;
}

/**
 * Lista o relatório agrupado por severidade, com filtro, seções colapsáveis
 * e suporte a "foco externo" (cards de estatística podem pedir para abrir
 * e rolar até uma seção específica).
 */
export function ReportList({
  items,
  activeFilter: controlledFilter,
  onFilterChange,
  focusRequest,
}: ReportListProps) {
  const [internalFilter, setInternalFilter] = useState<Severity | 'all'>('all');
  const filter = controlledFilter ?? internalFilter;
  const setFilter = (f: Severity | 'all') => {
    setInternalFilter(f);
    onFilterChange?.(f);
  };

  const groups = useMemo(() => {
    const map: Record<Severity, ReportItem[]> = { error: [], fix: [], warning: [], info: [] };
    for (const it of items) map[it.severity].push(it);
    return map;
  }, [items]);

  const visibleSeverities = ORDER.filter((s) => groups[s].length > 0);

  // Estado de colapso por severidade. Inicial: recolhida se > threshold.
  const [collapsed, setCollapsed] = useState<Record<Severity, boolean>>(() => ({
    error: false,
    fix: false,
    warning: false,
    info: false,
  }));

  // Refs de cada seção para scroll programático.
  const sectionRefs = useRef<Record<Severity, HTMLElement | null>>({
    error: null,
    fix: null,
    warning: null,
    info: null,
  });

  // Reage a pedido de foco vindo dos cards: expande a seção e rola até ela.
  useEffect(() => {
    if (!focusRequest) return;
    const { severity, nonce } = focusRequest;
    if (!nonce) return;
    // garante que a seção esteja visível no filtro atual
    setFilter(severity);
    // expande
    setCollapsed((c) => ({ ...c, [severity]: false }));
    // rola até a seção (depois do render)
    requestAnimationFrame(() => {
      const el = sectionRefs.current[severity];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest?.nonce]);

  if (visibleSeverities.length === 0) {
    return (
      <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-6 text-center text-sm text-brand-800 dark:border-brand-900 dark:bg-brand-950/40 dark:text-brand-300">
        Tudo certo. Nenhum problema encontrado.
      </div>
    );
  }

  const filtered = filter === 'all' ? visibleSeverities : [filter].filter((s) => visibleSeverities.includes(s as Severity)) as Severity[];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
          Todos ({items.length})
        </FilterChip>
        {visibleSeverities.map((s) => (
          <FilterChip key={s} active={filter === s} onClick={() => setFilter(s)} tone={s}>
            {LABELS[s]} ({groups[s].length})
          </FilterChip>
        ))}
      </div>

      {filtered.map((sev) => {
        const isCollapsed = collapsed[sev] && groups[sev].length > 0;
        return (
          <section
            key={sev}
            ref={(el) => {
              sectionRefs.current[sev] = el;
            }}
            className="overflow-hidden rounded-xl border border-slate-200 scroll-mt-4 dark:border-slate-700"
          >
            <SectionHeader
              sev={sev}
              count={groups[sev].length}
              collapsed={isCollapsed}
              onToggle={() => setCollapsed((c) => ({ ...c, [sev]: !c[sev] }))}
            />
            {!isCollapsed && (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {groups[sev].map((item, i) => (
                  <li key={i} className="px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <RowColTag row={item.row} column={item.column} />
                      <span className="text-slate-700 dark:text-slate-200">{item.message}</span>
                    </div>
                    {item.action && (
                      <div className="mt-1 flex items-start gap-2 text-xs text-brand-700 dark:text-brand-400">
                        <CheckIcon />
                        <span>{item.action}</span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function SectionHeader({
  sev,
  count,
  collapsed,
  onToggle,
}: {
  sev: Severity;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-controls={`report-section-${sev}`}
      className={[
        'flex w-full items-center gap-2 border-b px-4 py-2 text-left text-sm font-medium transition hover:brightness-95 dark:hover:brightness-110',
        headerTone(sev),
      ].join(' ')}
    >
      <ChevronIcon open={!collapsed} />
      <SevIcon sev={sev} />
      <span className="flex-1">
        {LABELS[sev]} <span className="opacity-70">({count})</span>
      </span>
    </button>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={['h-4 w-4 shrink-0 transition-transform', open ? 'rotate-90' : ''].join(' ')}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function FilterChip({
  active,
  onClick,
  children,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: Severity;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-full border px-3 py-1 text-xs font-medium transition',
        active
          ? chipActiveTone(tone)
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function chipActiveTone(tone?: Severity): string {
  switch (tone) {
    case 'error':
      return 'border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300';
    case 'fix':
      return 'border-brand-300 bg-brand-100 text-brand-800 dark:border-brand-800 dark:bg-brand-950/60 dark:text-brand-300';
    case 'warning':
      return 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
    case 'info':
      return 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200';
    default:
      return 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900';
  }
}

function headerTone(sev: Severity): string {
  switch (sev) {
    case 'error':
      return 'border-red-100 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300';
    case 'fix':
      return 'border-brand-100 bg-brand-50 text-brand-800 dark:border-brand-900/60 dark:bg-brand-950/30 dark:text-brand-300';
    case 'warning':
      return 'border-amber-100 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300';
    case 'info':
      return 'border-slate-100 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200';
  }
}

function RowColTag({ row, column }: { row?: number; column?: string }) {
  if (row === undefined && !column) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      {row !== undefined && row > 0 ? `L${row}` : row === 0 ? 'cabeçalho' : null}
      {row !== undefined && row > 0 && column ? ' · ' : null}
      {column ? column : null}
    </span>
  );
}

function SevIcon({ sev }: { sev: Severity }) {
  const cls = 'h-4 w-4 shrink-0';
  switch (sev) {
    case 'error':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      );
    case 'fix':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      );
    case 'warning':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case 'info':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      );
  }
}

function CheckIcon() {
  return (
    <svg className="mt-0.5 h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
