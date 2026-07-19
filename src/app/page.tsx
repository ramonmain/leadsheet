'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Dropzone } from '@/components/Dropzone';
import { ModeTabs, Mode } from '@/components/ModeTabs';
import { StatBadges } from '@/components/StatBadge';
import { ReportList, ReportListFocusRequest } from '@/components/ReportList';
import { ResultTable } from '@/components/ResultTable';
import { DownloadButtons } from '@/components/DownloadButtons';
import { ManualReviewEditor } from '@/components/ManualReviewEditor';

import { readSpreadsheetToMatrix } from '@/lib/spreadsheet';
import { normalizeRawMatrix, NormalizeResult, Severity } from '@/lib/normalize';
import { extractTextFromPdf } from '@/lib/pdf';
import { pdfPagesToLeadsMatrix, PdfToLeadsResult } from '@/lib/pdf-to-leads';

type Stage =
  | { kind: 'idle' }
  | { kind: 'processing'; fileName: string }
  | { kind: 'review'; raw: string[][]; reason?: string }
  | { kind: 'done'; result: NormalizeResult; fileName: string }
  | { kind: 'error'; message: string };

export default function HomePage() {
  const [mode, setMode] = useState<Mode>('validate');
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });
  const resetRef = useRef<() => void>(() => {});

  const accept = mode === 'pdf' ? '.pdf,application/pdf' : '.xls,.xlsx,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  const handleFile = useCallback(
    async (file: File) => {
      setStage({ kind: 'processing', fileName: file.name });
      try {
        if (mode === 'pdf') {
          if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
            throw new Error('Selecione um arquivo PDF.');
          }
          const { pages } = await extractTextFromPdf(file);
          const parsed: PdfToLeadsResult = pdfPagesToLeadsMatrix(pages);
          if (parsed.matrix.length === 0) {
            throw new Error(parsed.reason ?? 'Não foi possível extrair dados do PDF.');
          }
          if (parsed.ambiguous) {
            setStage({ kind: 'review', raw: parsed.matrix, reason: parsed.reason });
            return;
          }
          const result = normalizeRawMatrix(parsed.matrix);
          setStage({ kind: 'done', result, fileName: stripExt(file.name) });
          return;
        }

        // mode === 'validate'
        const matrix = await readSpreadsheetToMatrix(file);
        if (matrix.length === 0) {
          throw new Error('A planilha está vazia ou não pôde ser lida.');
        }
        const result = normalizeRawMatrix(matrix);
        setStage({ kind: 'done', result, fileName: stripExt(file.name) });
      } catch (err) {
        const message = friendlyError(err);
        setStage({ kind: 'error', message });
      }
    },
    [mode]
  );

  const reset = useCallback(() => setStage({ kind: 'idle' }), []);
  resetRef.current = reset;

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 pb-16 pt-6 sm:px-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <Logo />
        <ThemeToggle />
      </header>

      {/* Hero */}
      <section className="mt-8 mb-6 text-center sm:mt-12">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-4xl">
          Suas planilhas de leads, no padrão C2S.
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-base text-slate-600 dark:text-slate-400">
          Converta um <strong>PDF</strong> em planilha pronta para importar, ou valide e corrija
          automaticamente uma planilha existente. Tudo no seu navegador — seus dados não saem daqui.
        </p>

        <div className="mt-6 flex justify-center">
          <ModeTabs mode={mode} onChange={(m) => { setMode(m); reset(); }} />
        </div>
      </section>

      {/* Main */}
      <main className="flex-1">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-700 dark:bg-slate-900 sm:p-6">
          <Dropzone
            key={mode}
            accept={accept}
            label={mode === 'pdf' ? 'Solte o PDF dos leads aqui' : 'Solte a planilha aqui'}
            hint={
              mode === 'pdf'
                ? 'PDF com texto selecionável · até algumas dezenas de páginas'
                : 'Formatos aceitos: XLS, XLSX, CSV'
            }
            onFile={handleFile}
            disabled={stage.kind === 'processing'}
          />

          <div className="mt-4">
            {stage.kind === 'idle' && <IdleHints mode={mode} />}

            {stage.kind === 'processing' && (
              <ProcessingView fileName={stage.fileName} mode={mode} />
            )}

            {stage.kind === 'error' && (
              <ErrorView message={stage.message} onReset={reset} />
            )}

            {stage.kind === 'review' && (
              <ManualReviewEditor
                matrix={stage.raw}
                reason={stage.reason}
                onCancel={reset}
                onConfirm={(mapped) => {
                  const matrix = [mapped.header, ...mapped.rows];
                  const result = normalizeRawMatrix(matrix);
                  setStage({ kind: 'done', result, fileName: 'leadsheet_pdf' });
                }}
              />
            )}

            {stage.kind === 'done' && (
              <DoneView
                result={stage.result}
                fileName={stage.fileName}
                mode={mode}
                onReset={reset}
              />
            )}
          </div>
        </div>

        <Footer />
      </main>
    </div>
  );
}

/* ---------- Subviews ---------- */

function IdleHints({ mode }: { mode: Mode }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {[
        mode === 'pdf'
          ? { t: 'Extração no navegador', d: 'Usamos o pdf.js — seu arquivo não é enviado a nenhum servidor.' }
          : { t: 'Leitura local', d: 'Sua planilha é processada inteiramente no seu navegador.' },
        { t: 'Correção automática', d: 'Reordenamos colunas para o padrão A→J e movemos extras para "Mensagem".' },
        { t: 'Relatório claro', d: 'Você vê linha a linha o que foi corrigido e o que precisa de atenção.' },
      ].map((c) => (
        <div
          key={c.t}
          className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-sm dark:border-slate-800 dark:bg-slate-800/40"
        >
          <div className="font-medium text-slate-800 dark:text-slate-100">{c.t}</div>
          <div className="mt-0.5 text-slate-500 dark:text-slate-400">{c.d}</div>
        </div>
      ))}
    </div>
  );
}

function ProcessingView({ fileName, mode }: { fileName: string; mode: Mode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <Spinner />
      <div className="text-sm text-slate-600 dark:text-slate-300">
        {mode === 'pdf' ? 'Extraindo texto do PDF' : 'Lendo planilha'}: <span className="font-medium">{fileName}</span>…
      </div>
    </div>
  );
}

function ErrorView({ message, onReset }: { message: string; onReset: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
      <div className="flex items-start gap-2">
        <WarnIcon />
        <div className="flex-1">
          <div className="font-semibold">Não foi possível concluir.</div>
          <div className="mt-0.5">{message}</div>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-700 transition hover:bg-red-100 dark:border-red-800 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-950/50"
        >
          Tentar de novo
        </button>
      </div>
    </div>
  );
}

function DoneView({
  result,
  fileName,
  mode,
  onReset,
}: {
  result: NormalizeResult;
  fileName: string;
  mode: Mode;
  onReset: () => void;
}) {
  const base = mode === 'pdf' ? `${fileName}_convertido` : `${fileName}_corrigido`;

  // Filtro/foco do relatório controlado pelos cards de estatística.
  const [activeFilter, setActiveFilter] = useState<Severity | 'all'>('all');
  const [focusRequest, setFocusRequest] = useState<ReportListFocusRequest | null>(null);

  function handleCardClick(target: Exclude<Severity | 'all', null>) {
    if (target === 'all') {
      setActiveFilter('all');
      // rola suavemente até o relatório
      const el = document.getElementById('report-block') as HTMLDivElement | null;
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setActiveFilter(target);
    // nonce força o efeito no ReportList a rodar mesmo se a sev for a mesma
    setFocusRequest({ severity: target, nonce: Date.now() });
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatBadges stats={result.stats} onFocusRequest={handleCardClick} />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            Novo arquivo
          </button>
        </div>
      </div>

      <div id="report-block" className="scroll-mt-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Relatório
        </h2>
        <ReportList
          items={result.report}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          focusRequest={focusRequest}
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Pré-visualização
          </h2>
          <span className="text-xs text-slate-400">
            {result.rows.length} linha(s) pronta(s) para importar
          </span>
        </div>
        <ResultTable rows={result.rows} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Pronto para importar no C2S no formato XLSX.
        </p>
        <DownloadButtons rows={result.rows} baseName={base} />
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-10 text-center text-xs text-slate-400 dark:text-slate-600">
      Processamento 100% local · nenhum dado é enviado para servidores · C2S Padronizador
    </footer>
  );
}

/* ---------- Helpers visuais ---------- */

function Spinner() {
  return (
    <svg className="h-8 w-8 animate-spin text-brand-600 dark:text-brand-400" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

/* ---------- Util ---------- */

function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}

function friendlyError(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message || '';
    // Mensagens comuns do pdf.js em PT
    if (/password|encrypted/i.test(msg)) {
      return 'O PDF parece estar protegido por senha. Remova a proteção e tente novamente.';
    }
    if (/InvalidPDF|structure/i.test(msg)) {
      return 'O arquivo não é um PDF válido ou está corrompido.';
    }
    return msg;
  }
  return 'Ocorreu um erro inesperado. Tente com outro arquivo.';
}
