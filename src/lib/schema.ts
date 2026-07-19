/**
 * Schema oficial da planilha de leads do C2S.
 * Ordem exata (A -> J). NAO alterar sem alinhar com o produto.
 */

export const C2S_COLUMNS = [
  { key: 'nome',      label: 'Nome',           required: 'yes' as const },
  { key: 'email',     label: 'E-mail',         required: 'conditional' as const },
  { key: 'telefone',  label: 'Telefone',       required: 'conditional' as const },
  { key: 'produto',   label: 'Produto',        required: 'yes' as const },
  { key: 'valor',     label: 'Valor',          required: 'no' as const },
  { key: 'data',      label: 'Data de criacao', required: 'no' as const },
  { key: 'usuario',   label: 'Usuario',        required: 'no' as const },
  { key: 'mensagem',  label: 'Mensagem',       required: 'no' as const },
  { key: 'codigo',    label: 'Codigo',         required: 'no' as const },
  { key: 'origem',    label: 'Origem',         required: 'no' as const },
] as const;

export type C2SKey = (typeof C2S_COLUMNS)[number]['key'];

export const C2S_KEYS: C2SKey[] = C2S_COLUMNS.map((c) => c.key);
export const C2S_LABELS: string[] = C2S_COLUMNS.map((c) => c.label);

/** Mapa de sinonimos comuns -> chave oficial. Lowercase, sem acento.
 *  Inclui plurais explicitos (clientes, telefones, emails, etc.) para casar
 *  com cabecalhos reais de bases enviadas por clientes. */
export const SYNONYMS: Record<string, C2SKey> = {
  // Nome
  nome: 'nome',
  nomes: 'nome',
  nomecompleto: 'nome',
  nomescompletos: 'nome',
  cliente: 'nome',
  clientes: 'nome',
  lead: 'nome',
  leads: 'nome',
  contato: 'nome',
  contatos: 'nome',
  pessoa: 'nome',
  pessoas: 'nome',
  // E-mail
  email: 'email',
  emails: 'email',
  'e-mail': 'email',
  'e-mails': 'email',
  mail: 'email',
  correo: 'email',
  correos: 'email',
  // Telefone
  telefone: 'telefone',
  telefones: 'telefone',
  tel: 'telefone',
  tels: 'telefone',
  cel: 'telefone',
  celular: 'telefone',
  celulares: 'telefone',
  whatsapp: 'telefone',
  whats: 'telefone',
  fone: 'telefone',
  fones: 'telefone',
  numero: 'telefone',
  // Produto
  produto: 'produto',
  produtos: 'produto',
  item: 'produto',
  itens: 'produto',
  servico: 'produto',
  servicos: 'produto',
  interesse: 'produto',
  interesses: 'produto',
  interessado: 'produto',
  // Valor
  valor: 'valor',
  valores: 'valor',
  preco: 'valor',
  precos: 'valor',
  valorproduto: 'valor',
  // Data
  data: 'data',
  datas: 'data',
  datacriacao: 'data',
  criadoem: 'data',
  // Usuario
  usuario: 'usuario',
  usuarios: 'usuario',
  user: 'usuario',
  users: 'usuario',
  responsavel: 'usuario',
  responsaveis: 'usuario',
  vendedor: 'usuario',
  vendedores: 'usuario',
  atendente: 'usuario',
  // Mensagem
  mensagem: 'mensagem',
  mensagens: 'mensagem',
  msg: 'mensagem',
  msgs: 'mensagem',
  observacao: 'mensagem',
  observacoes: 'mensagem',
  obs: 'mensagem',
  comentario: 'mensagem',
  comentarios: 'mensagem',
  // Codigo
  codigo: 'codigo',
  codigos: 'codigo',
  cod: 'codigo',
  ref: 'codigo',
  id: 'codigo',
  // Origem
  origem: 'origem',
  origens: 'origem',
  canal: 'origem',
  canais: 'origem',
  fonte: 'origem',
  fontes: 'origem',
  midia: 'origem',
};

export type FieldType = 'string' | 'number' | 'date';

export type C2SRow = Partial<Record<C2SKey, string>> & { __rowIndex?: number };
