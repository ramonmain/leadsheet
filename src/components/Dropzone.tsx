'use client';

import React, { useCallback, useRef, useState } from 'react';

interface DropzoneProps {
  accept: string; // ex.: ".pdf" ou ".xls,.xlsx,.csv"
  label: string;
  hint: string;
  onFile: (file: File) => void;
  disabled?: boolean;
}

/**
 * Área de drag-and-drop com feedback esmeralda no hover.
 * Também aceita clique para abrir o seletor de arquivo.
 */
export function Dropzone({ accept, label, hint, onFile, disabled }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      onFile(files[0]);
    },
    [onFile]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (disabled) return;
        handleFiles(e.dataTransfer.files);
      }}
      className={[
        'group relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition outline-none',
        'cursor-pointer',
        dragging
          ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200 dark:border-brand-500 dark:bg-brand-950/40 dark:ring-brand-800'
          : 'border-slate-300 bg-slate-50/60 hover:border-brand-400 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-brand-700 dark:hover:bg-brand-950/20',
        disabled ? 'pointer-events-none opacity-60' : '',
      ].join(' ')}
    >
      <UploadIcon className="h-7 w-7 text-slate-400 transition group-hover:text-brand-600 dark:text-slate-500 dark:group-hover:text-brand-400" />
      <div>
        <p className="text-base font-medium text-slate-800 dark:text-slate-100">{label}</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{hint}</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}

function UploadIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
