/**
 * Extracao de texto de PDF no client via pdf.js (pdfjs-dist).
 * 100% no navegador: o arquivo nunca sai da maquina do usuario.
 *
 * Worker: carregado pelo bundler do Next/webpack 5 via `new Worker(new URL(...))`.
 */

/**
 * Extração de texto de PDF no client via pdf.js (pdfjs-dist).
 * 100% no navegador: o arquivo nunca sai da maquina do usuario.
 *
 * Para evitar que o Next tente avaliar `pdfjs-dist` (e instanciar o Worker)
 * durante o pré-render estático no servidor, importamos a lib DINAMICAMENTE
 * só dentro de `extractTextFromPdf` — que só roda no client, num event handler.
 */

// `typeof Worker` so existe no browser; com isso o bundler nao toca no
// `new Worker(...)` durante SSR/prerender.
type PdfJsLib = typeof import('pdfjs-dist');

let pdfjsLibPromise: Promise<PdfJsLib> | null = null;
function loadPdfjs(): Promise<PdfJsLib> {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import('pdfjs-dist').then((lib) => {
      // Configura o worker só quando a lib realmente carrega (client).
      if (typeof Worker !== 'undefined') {
        lib.GlobalWorkerOptions.workerPort = new Worker(
          new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url),
          { type: 'module' }
        );
      }
      return lib;
    });
  }
  return pdfjsLibPromise;
}

export interface PdfTextItem {
  str: string;
  x: number; // posicao horizontal (transform[4])
  y: number; // posicao vertical (transform[5])
  w: number; // largura aproximada
}

export interface PdfPageText {
  page: number; // 1-indexed
  width: number;
  height: number;
  items: PdfTextItem[];
}

/**
 * Extrai texto de todas as paginas de um PDF, preservando posicoes (x, y).
 * Necessario para a heuristica de deteccao de colunas em `pdf-to-leads.ts`.
 */
export async function extractTextFromPdf(
  file: File
): Promise<{ pages: PdfPageText[] }> {
  const pdfjsLib = await loadPdfjs();
  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(buf),
    // desativa fontes/canvas; so precisamos do texto
    disableFontFace: true,
    isEvalSupported: false,
  }).promise;

  const pages: PdfPageText[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    const items: PdfTextItem[] = [];
    for (const item of content.items) {
      // `item` pode ser TextItem ou TextMarkedContent; so nos interessa o primeiro
      if (!('str' in item)) continue;
      const ti = item as { str: string; transform: number[]; width?: number };
      const str = ti.str;
      if (str === '' || str === ' ') continue;
      items.push({
        str,
        x: ti.transform[4],
        y: ti.transform[5],
        w: ti.width ?? 0,
      });
    }

    pages.push({
      page: i,
      width: viewport.width,
      height: viewport.height,
      items,
    });
  }

  try {
    await doc.destroy();
  } catch {
    /* noop */
  }

  return { pages };
}
