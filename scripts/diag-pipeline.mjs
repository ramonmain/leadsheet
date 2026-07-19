// Roda o pipeline atual (pdf-to-leads + normalize) contra o PDF real
// para medir o antes/depois e validar o fix.
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { pathToFileURL } from 'node:url';
import { resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';

pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
  pathResolve('node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')
).href;

const pdfPath = process.argv[2] || 'C:\\Users\\ramon\\Downloads\\planilha.pdf';
const data = readFileSync(pdfPath);

const doc = await pdfjsLib.getDocument({
  data: new Uint8Array(data),
  disableFontFace: true,
  isEvalSupported: false,
}).promise;

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

// Importa o pipeline (transpila TS on the fly via tsx não disponível;
// em vez disso, replicamos a chamada importando o .ts com --loader tsx).
// Para simplicidade, vamos importar via tsx esm.
const { pdfPagesToLeadsMatrix } = await import('../src/lib/pdf-to-leads.ts');
const { normalizeRawMatrix } = await import('../src/lib/normalize.ts');

console.log(`\n=== PIPELINE ATUAL contra ${pdfPath} ===`);
const parsed = pdfPagesToLeadsMatrix(pages);
console.log(`Ambiguous: ${parsed.ambiguous} | reason: ${parsed.reason ?? '(nenhum)'}`);
console.log(`Matrix: ${parsed.matrix.length} linhas (incl. header)`);
console.log(`Detected cols:`);
for (const d of parsed.detected) {
  console.log(`  [${d.colIndex}] "${d.header}" -> ${d.key ?? '?'} | amostra: "${d.sample}"`);
}

console.log('\n--- Normalizacao ---');
const result = normalizeRawMatrix(parsed.matrix);
console.log(`Total lido:    ${result.stats.totalRows}`);
console.log(`Validas:       ${result.stats.validRows}`);
console.log(`Invalidas:     ${result.stats.invalidRows}`);
console.log(`Extras p/ msg: ${result.stats.extrasMoved}`);
console.log(`Reordenou:     ${result.stats.reordered}`);

console.log('\n--- Primeiras 5 linhas validas ---');
for (const r of result.rows.slice(0, 5)) {
  console.log(`  nome="${r.nome ?? ''}" tel="${r.telefone ?? ''}" prod="${r.produto ?? ''}"`);
}
console.log('\n--- Primeiras 5 invalidas ---');
for (const r of result.invalidRows.slice(0, 5)) {
  console.log(`  nome="${r.nome ?? ''}" tel="${r.telefone ?? ''}" email="${r.email ?? ''}"`);
}

await doc.destroy();
