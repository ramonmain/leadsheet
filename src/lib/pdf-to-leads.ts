/**
 * Heuristica: texto do PDF (com posicoes) -> matriz raw [header, ...linhas]
 * para alimentar `normalizeRawMatrix`.
 *
 * Estrategia (v2 - extracao posicional):
 *  1. Agrupar itens por linha (mesma `y`, tolerancia ~3px).
 *  2. Identificar a linha de cabecalho (primeira linha com 2+ itens cujo
 *     texto reconhecivel como coluna de leads).
 *  3. Usar as posicoes x do cabecalho como intervalos de coluna.
 *  4. Mapear cada linha de dado para a coluna mais proxima (por x).
 *  5. Fallback: se o cabecalho nao for reconhecido, tentar detectar
 *     colunas por conteudo (telefone, email) e posicao x.
 *  6. Retornar matriz estruturada ou sinalizar como ambigua.
 */

import { PdfPageText } from './pdf';
import { resolveColumnKeyDetailed } from './normalize';
import { C2SKey } from './schema';

export interface PdfToLeadsResult {
  matrix: string[][]; // [header, ...dataRows]
  ambiguous: boolean;
  reason?: string;
  /** Deteccao automatica por coluna (indice da matriz). Null = nao reconhecido. */
  detected: ColumnDetection[];
}

export interface ColumnDetection {
  colIndex: number;
  header: string;
  key: C2SKey | null;
  sample: string; // primeiro valor nao vazio da coluna
  /** como chegamos ao resultado: sinonimo exato, singularizacao, etc. */
  matchType: 'exact' | 'singularized' | 'none';
}

const ROW_TOLERANCE = 3; // px de tolerancia p/ considerar mesma linha

// Regex para detectar padrao de telefone BR: (11) 99999-8888, 11999998888, etc.
const PHONE_RE = /\(?\d{2}\)?\s?\d{4,5}-?\d{4}/;
// Regex para detectar email
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

/**
 * Agrupa itens por linha (y proximo), ordenando de cima para baixo
 * (y maior = mais acima no PDF, pois a origem fica embaixo).
 */
function groupByRow(
  items: { str: string; x: number; y: number; w: number }[]
): { y: number; items: { str: string; x: number; w: number }[] }[] {
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);

  const rows: { y: number; items: { str: string; x: number; w: number }[] }[] = [];
  for (const it of sorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last.y - it.y) <= ROW_TOLERANCE) {
      last.items.push({ str: it.str, x: it.x, w: it.w });
    } else {
      rows.push({ y: it.y, items: [{ str: it.str, x: it.x, w: it.w }] });
    }
  }

  // cada linha ordenada por x (esquerda -> direita)
  for (const r of rows) r.items.sort((a, b) => a.x - b.x);
  return rows;
}

/**
 * Agrupa fragmentos de texto (runs do PDF) em "tokens" distintos.
 *
 * Cada token = um pedaco de texto que parece ser uma celula separada.
 * Heuristica: gap > CELL_GAP_THRESHOLD entre runs consecutivos => token novo.
 *
 * Esses tokens ainda NAO sao celulas finais; eles sao atribuidos as colunas
 * do cabecalho por proximidade de x em `assignToColumns`. Assim, runs que
 * pertencem a colunas diferentes (ex.: telefone e interesse, que podem ter
 * gap pequeno entre si) nao sao fundidos aqui.
 */
const CELL_GAP_THRESHOLD = 6; // px - gap tipico entre runs da MESMA celula

function joinFragments(
  items: { str: string; x: number; w: number }[]
): { str: string; x: number }[] {
  if (items.length === 0) return [];
  const out: { str: string; x: number }[] = [{ str: items[0].str, x: items[0].x }];
  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1];
    const cur = items[i];
    const gap = cur.x - (prev.x + prev.w);
    const top = out[out.length - 1];
    if (gap <= CELL_GAP_THRESHOLD) {
      // mesmo token (run quebrado ou palavras juntas)
      if (gap <= 2) top.str += cur.str;
      else {
        if (!top.str.endsWith(' ')) top.str += ' ';
        top.str += cur.str;
      }
    } else {
      // gap grande -> token novo (possivel coluna diferente)
      out.push({ str: cur.str, x: cur.x });
    }
  }
  return out.map((c) => ({ str: c.str.replace(/\s+/g, ' ').trim(), x: c.x }));
}

/**
 * Extrai as posicoes x dos itens do cabecalho para usar como
 * centros de coluna. Cada item do cabecalho vira uma coluna candidata.
 */
function headerToColumns(
  headerItems: { str: string; x: number }[]
): number[] {
  if (headerItems.length === 0) return [];
  return [...headerItems].sort((a, b) => a.x - b.x).map((item) => item.x);
}

/**
 * Detecta "limites" de colunas a partir das posicoes x de todos os itens.
 * Estrategia: pegar todos os x unicos (arredondados), agrupar
 * os proximos (<= 8px) num unico cluster. Cada cluster = coluna candidata.
 * Usado como fallback quando o cabecalho nao da resultados.
 */
function detectColumnBuckets(xs: number[]): number[] {
  if (xs.length === 0) return [];
  const sorted = [...xs].sort((a, b) => a - b);
  const buckets: number[] = [sorted[0]];
  for (const x of sorted) {
    const last = buckets[buckets.length - 1];
    if (x - last > 8) buckets.push(x);
  }
  return buckets;
}

/**
 * Atribui cada celula de uma linha a um bucket (coluna) pelo x mais proximo.
 */
function rowToCells(
  cells: { str: string; x: number }[],
  buckets: number[]
): string[] {
  if (buckets.length === 0) return [];
  const out: string[] = buckets.map(() => '');
  for (const cell of cells) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < buckets.length; i++) {
      const d = Math.abs(buckets[i] - cell.x);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    out[bestIdx] = out[bestIdx] ? `${out[bestIdx]} ${cell.str}`.trim() : cell.str;
  }
  return out;
}

/**
 * Tenta identificar a linha de cabecalho dentro de um conjunto de linhas.
 * Procura a primeira linha que tenha ao menos 2 itens e cujo texto
 * contenha sinonimos reconheciveis de colunas C2S.
 * Se nao encontrar, retorna a primeira linha com mais itens.
 */
function findHeaderRow(
  rows: { y: number; items: { str: string; x: number; w: number }[] }[]
): number {
  // Primeiro, tenta encontrar linha com sinonimos reconheciveis
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const text = rows[i].items.map((it) => it.str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')).join(' ');
    const knownWords = ['cliente', 'clientes', 'nome', 'telefone', 'telefones', 'fone', 'whatsapp',
      'email', 'e-mail', 'interesse', 'interesses', 'produto', 'produtos', 'valor', 'data',
      'usuario', 'mensagem', 'codigo', 'origem', 'celular', 'contato'];
    const found = knownWords.filter((w) => text.includes(w));
    if (found.length >= 2) return i;
    // Se tem 3+ itens na linha, provavelmente e cabecalho mesmo sem sinonimos
    if (rows[i].items.length >= 3 && found.length >= 1) return i;
  }
  // Fallback: linha com mais itens nas primeiras 5 linhas
  let bestIdx = 0;
  let bestCount = 0;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    if (rows[i].items.length > bestCount) {
      bestCount = rows[i].items.length;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Detecta colunas por conteudo (telefone, email) como fallback
 * quando o cabecalho nao foi reconhecido.
 * Retorna um mapeamento de indice de coluna para chave C2S.
 */
function detectColumnsByContent(
  grid: string[][],
  headerIdx: number
): Record<number, C2SKey> {
  const mapping: Record<number, C2SKey> = {};
  const numCols = grid[0]?.length ?? 0;

  // Para cada coluna, amostra valores das primeiras linhas de dados
  for (let c = 0; c < numCols; c++) {
    const sampleValues: string[] = [];
    for (let r = headerIdx + 1; r < Math.min(grid.length, headerIdx + 11); r++) {
      const val = (grid[r]?.[c] ?? '').trim();
      if (val) sampleValues.push(val);
    }

    // Deteccao por padrao de telefone
    const phoneCount = sampleValues.filter((v) => PHONE_RE.test(v)).length;
    if (phoneCount >= Math.max(1, sampleValues.length * 0.3)) {
      mapping[c] = 'telefone';
      continue;
    }

    // Deteccao por padrao de email
    const emailCount = sampleValues.filter((v) => EMAIL_RE.test(v)).length;
    if (emailCount >= Math.max(1, sampleValues.length * 0.3)) {
      mapping[c] = 'email';
      continue;
    }
  }

  // Fallback: se pelo menos uma coluna foi identificada por conteudo
  // e a coluna 0 ainda esta sem mapeamento, assume que e Nome.
  if (Object.keys(mapping).length > 0 && !mapping[0]) {
    mapping[0] = 'nome';
  }

  return mapping;
}

/**
 * Mescla "linhas de continuacao" de nomes longos que o PDF quebrou em varias
 * linhas (uma palavra por linha).
 *
 * Criterio para uma linha ser considerada continuacao:
 *  - tem conteudo APENAS na coluna 0 (nome), todas as demais vazias;
 *  - a linha anterior (na grade, ignorando o cabecalho) existe e tem nome;
 *  - a linha anterior NAO era ela propria uma continuacao vazia (evita cadeias
 *    absurdas).
 *
 * Linha "so nome" que vem entre duas linhas completas (ex.: uma pessoa sem
 * telefone) NAO eh tocada aqui - permanece como linha propria e sera tratada
 * pela validacao (provavelmente invalida, sem contato).
 *
 * Mutates `grid` in place. grid[0] eh o cabecalho.
 */
function mergeContinuationNameRows(grid: string[][]): void {
  if (grid.length < 3) return; // header + 2 dados, no minimo
  const numCols = grid[0].length;
  if (numCols < 2) return;

  // percorre de cima para baixo (apos header), mesclando na anterior
  for (let i = 2; i < grid.length; i++) {
    const cur = grid[i];
    // so nome (col 0) e nada nas demais?
    const onlyName =
      (cur[0] ?? '').trim() !== '' &&
      cur.slice(1).every((c) => (c ?? '').trim() === '');
    if (!onlyName) continue;

    const prev = grid[i - 1];
    // anterior deve ter nome (nao ser vazia) e ter algo alem do nome
    // (se anterior tb so tem nome, encadeamos - nome com 3+ palavras)
    const prevHasName = (prev[0] ?? '').trim() !== '';
    if (!prevHasName) continue;

    // anexa o nome da linha atual ao nome da anterior
    prev[0] = `${prev[0]} ${cur[0]}`.replace(/\s+/g, ' ').trim();
    // marca linha atual para remocao
    cur[0] = '__MERGED__';
  }

  // remove as linhas marcadas
  for (let i = grid.length - 1; i >= 0; i--) {
    if (grid[i][0] === '__MERGED__') grid.splice(i, 1);
  }
}

export function pdfPagesToLeadsMatrix(pages: PdfPageText[]): PdfToLeadsResult {
  // Junta todas as paginas
  const allRows: { y: number; items: { str: string; x: number; w: number }[] }[] = [];
  for (const p of pages) {
    allRows.push(...groupByRow(p.items));
  }

  if (allRows.length === 0) {
    return {
      matrix: [],
      ambiguous: true,
      reason: 'O PDF nao contem texto selecionavel. Pode ser uma imagem escaneada.',
      detected: [],
    };
  }

  // ---- Etapa 1: identificar linha de cabecalho ----
  const headerIdx = findHeaderRow(allRows);
  const headerRow = allRows[headerIdx];
  const headerFragments = joinFragments(headerRow.items);

  // ---- Etapa 2: definir colunas a partir do cabecalho ----
  let columns = headerToColumns(headerFragments);

  // Se o cabecalho tem poucas colunas (1 ou 2), tenta fallback com todas as linhas
  if (columns.length <= 1) {
    const allX: number[] = [];
    for (const r of allRows) for (const it of r.items) allX.push(it.x);
    const buckets = detectColumnBuckets(allX);
    if (buckets.length > columns.length) {
      // Usa fallback: constroi grid com buckets simples
      const simpleGrid: string[][] = allRows.map((r) => {
        const fragments = joinFragments(r.items);
        return rowToCells(fragments, buckets);
      });

      // Remove colunas totalmente vazias
      let filteredGrid = simpleGrid;
      let filteredBuckets = buckets;
      if (filteredGrid.length > 0 && filteredBuckets.length > 0) {
        const colNonEmpty = filteredBuckets.map((_, c) =>
          filteredGrid.some((row) => (row[c] ?? '').trim() !== '')
        );
        const keepIdx = colNonEmpty.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
        filteredGrid = filteredGrid.map((row) => keepIdx.map((i) => row[i] ?? ''));
        filteredBuckets = keepIdx.map((i) => filteredBuckets[i]);
      }

      return buildResultFromGrid(filteredGrid, filteredBuckets.length);
    }
  }

  // ---- Etapa 3: montar grade ----
  const headerCells = headerFragments.map((it) => it.str);
  const grid: string[][] = [headerCells];

  for (let i = 0; i < allRows.length; i++) {
    if (i === headerIdx) continue; // pula a linha que ja usamos como cabecalho
    const fragments = joinFragments(allRows[i].items);
    const cells = rowToCells(fragments, columns);
    grid.push(cells);
  }

  // ---- Etapa 3.5: mesclar "linhas de continuacao" ----
  // Nomes longos no PDF muitas vezes quebram em varias linhas (uma por palavra).
  // Ex.: MAIARA (com telefone) / GARCIA (so nome) / PEREIRA (so nome).
  // Regra: uma linha que so tem conteudo na coluna 0 (nome) e nada nas demais
  // eh uma continuacao do nome da linha de dados anterior (se existir).
  mergeContinuationNameRows(grid);

  // ---- Etapa 4: remover colunas totalmente vazias ----
  if (grid.length > 0 && columns.length > 0) {
    const colNonEmpty = columns.map((_, c) =>
      grid.some((row) => (row[c] ?? '').trim() !== '')
    );
    const keepIdx = colNonEmpty.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
    const filteredGrid = grid.map((row) => keepIdx.map((i) => row[i] ?? ''));
    grid.splice(0, grid.length, ...filteredGrid);
    columns = keepIdx.map((i) => columns[i]);
  }

  return buildResultFromGrid(grid, columns.length);
}

/**
 * Constroi o resultado final a partir da grade.
 * Tenta detectar cabecalhos conhecidos; se falhar,
 * tenta deteccao por conteudo (telefone/email).
 */
function buildResultFromGrid(grid: string[][], numCols: number): PdfToLeadsResult {
  if (numCols <= 1) {
    // So tem 1 coluna: provavelmente texto livre / lista.
    return {
      matrix: grid.length ? [['Conteudo'], ...grid] : [],
      ambiguous: true,
      reason:
        'Nao foi possivel identificar colunas no PDF (texto livre). Revise o mapeamento manualmente.',
      detected: buildDetection(grid),
    };
  }

  // Deteccao por cabecalho
  const detected = buildDetection(grid);
  const recognizedCount = detected.filter((d) => d.key !== null).length;

  if (recognizedCount === 0) {
    // Tenta detectar colunas por conteudo (telefone, email)
    const contentMapping = detectColumnsByContent(grid, 0);
    const contentKeys = Object.keys(contentMapping).length;

    if (contentKeys > 0) {
      // Monta uma deteccao mesclando cabecalho original com deteccao por conteudo
      const mergedDetected = detected.map((d, i) => {
        if (contentMapping[i]) {
          return {
            ...d,
            key: contentMapping[i],
            matchType: 'exact' as const,
          };
        }
        return d;
      });

      return {
        matrix: grid,
        ambiguous: true,
        reason:
          `Colunas detectadas por conteudo (${contentKeys} coluna(s) identificada(s) por telefone/email). ` +
          'Revise o mapeamento antes de confirmar.',
        detected: mergedDetected,
      };
    }

    // Nada reconhecido
    return {
      matrix: grid,
      ambiguous: true,
      reason:
        'As colunas foram detectadas, mas os cabecalhos nao foram reconhecidos. Mapeie cada coluna manualmente.',
      detected,
    };
  }

  // Tabela estruturada suficiente
  return {
    matrix: grid,
    ambiguous: false,
    detected,
  };
}

/**
 * Constroi a lista de deteccao por coluna a partir da grade.
 * O cabecalho eh a primeira linha; a amostra eh o primeiro valor nao vazio.
 */
function buildDetection(grid: string[][]): ColumnDetection[] {
  const header = grid[0] ?? [];
  return header.map((h, i) => {
    const res = resolveColumnKeyDetailed(h);
    let sample = '';
    for (let r = 1; r < grid.length; r++) {
      const v = (grid[r][i] ?? '').trim();
      if (v) {
        sample = v;
        break;
      }
    }
    return {
      colIndex: i,
      header: h ?? '',
      key: res.key,
      sample,
      matchType: res.matchType === 'none' ? 'none' : 'exact',
    };
  });
}
