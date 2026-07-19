// Diagnostico: extrai itens de texto do PDF com coordenadas (x,y)
// para entender a estrutura real e descobrir onde o algoritmo falha.
// Uso: node scripts/diag-pdf.mjs <caminho-do-pdf>

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { pathToFileURL } from 'node:url';

const pdfPath = process.argv[2] || 'C:\\Users\\ramon\\Downloads\\planilha.pdf';

// Em Node, aponta o workerSrc para o arquivo do worker do pdfjs-dist.
const workerUrl = pathToFileURL(
  await import('node:path').then((p) => p.resolve('node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'))
).href;
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const data = await import('node:fs').then((fs) => fs.readFileSync(pdfPath));

const doc = await pdfjsLib.getDocument({
  data: new Uint8Array(data),
  disableFontFace: true,
  isEvalSupported: false,
}).promise;

console.log(`Páginas: ${doc.numPages}\n`);

for (let p = 1; p <= Math.min(doc.numPages, 2); p++) {
  const page = await doc.getPage(p);
  const vp = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();

  console.log(`=== PAGINA ${p} (${vp.width.toFixed(0)} x ${vp.height.toFixed(0)}) ===`);
  console.log(`Total de itens: ${content.items.length}\n`);

  // Agrupar por y (mesma logica do app)
  const items = [];
  for (const it of content.items) {
    if (!('str' in it)) continue;
    if (it.str === '' || it.str === ' ') continue;
    items.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width ?? 0 });
  }

  // Ordenar por y decrescente (topo -> base), depois x
  items.sort((a, b) => b.y - a.y || a.x - b.x);

  // Agrupar em linhas (tolerancia 3px)
  const rows = [];
  for (const it of items) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last.y - it.y) <= 3) {
      last.items.push(it);
    } else {
      rows.push({ y: it.y, items: [it] });
    }
  }

  console.log(`Linhas detectadas: ${rows.length}\n`);
  console.log('PRIMEIRAS 12 LINHAS (y | itens ordenados por x):');
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const r = rows[i];
    const parts = r.items
      .map((it) => `[x=${it.x.toFixed(0)} w=${it.w.toFixed(0)}] "${it.str}"`)
      .join('  ');
    console.log(`  y=${r.y.toFixed(1)} | ${parts}`);
  }

  // Histograma de X (para ver colunas candidatas)
  console.log('\nHISTOGRAMA DE X (top 15 valores mais frequentes):');
  const xCounts = {};
  for (const it of items) {
    const k = Math.round(it.x);
    xCounts[k] = (xCounts[k] || 0) + 1;
  }
  const sortedX = Object.entries(xCounts).sort((a, b) => Number(b[1]) - Number(a[1]));
  for (const [x, n] of sortedX.slice(0, 15)) {
    console.log(`  x=${x}  -> ${n} itens`);
  }
  console.log('');
}

await doc.destroy();
