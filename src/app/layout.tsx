import type { Metadata } from 'next';
import { Inter, Fraunces } from 'next/font/google';
import React from 'react';
import { buildThemeNoFlashScript } from '@/lib/theme';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  // só pesos de display/serif para o wordmark
  weight: ['500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'C2S · Padronizador de Planilhas',
  description:
    'Converta PDFs de leads em planilha padrão e valide/corrija planilhas importadas — direto no navegador, sem enviar seus dados para lugar nenhum.',
  applicationName: 'C2S Padronizador',
  robots: { index: true, follow: true },
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1120' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${fraunces.variable}`} suppressHydrationWarning>
      <head>
        {/* Script anti-flash: aplica o tema ANTES do paint. */}
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: buildThemeNoFlashScript() }}
        />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
