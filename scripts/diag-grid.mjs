// Debug: mostra a grade crua gerada pelo algoritmo antes da normalizacao.
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { pathToFileURL } from 'node:url';
import { resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';

pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
  pathResolve('node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')
).href;

const pdfPath = process.argv[2] || 'C:\\Users\\ramon\\Downloads\\planilha.pdf';
const data = readFileSync(pdfPath);
const doc = await pdfjsLib.getDocument({ data: new Uint8Array(data), disableFontFace: true, isEvalSupported: false }).promise;

const pages = [];
for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i);
  const vp = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items = [];
  for (const it of content.items) {
    if (!('str' in it)) continue;
    if (it.str === '' || it.str === ' ') continue;
    items.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width ?? 0 });
  }
  pages.push({ page: i, width: vp.width, height: vp.height, items });
}

const { pdfPagesToLeadsMatrix } = await import('../src/lib/pdf-to-leads.ts');
const parsed = pdfPagesToLeadsMatrix(pages);

console.log('=== GRADE CRUA (primeiras 15 linhas) ===');
for (let i = 0; i < Math.min(parsed.matrix.length, 15); i++) {
  const row = parsed.matrix[i];
  console.log(`[${i}] cols=${row.length}: ` + row.map((c, j) => `[${j}]"${c}"`).join('  '));
}

await doc.destroy();
