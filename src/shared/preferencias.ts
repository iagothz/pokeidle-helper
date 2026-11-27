import * as z from 'zod';

export const CHAVE_PREFERENCIAS = 'pokeidleHelper.ui';
export const ABAS_PAINEL = [
  'sessao',
  'time',
  'progresso',
  'economia',
  'hunts',
  'historico',
  'opcoes',
] as const;
export type AbaPainel = (typeof ABAS_PAINEL)[number];

export interface Posicao {
  x: number;
  y: number;
}

export const TAMANHOS_PAINEL = Object.freeze([
  { largura: 400, alturaVh: 76 },
  { largura: 520, alturaVh: 82 },
  { largura: 680, alturaVh: 88 },
  { largura: 860, alturaVh: 92 },
]);

export interface FiltrosUi {
  huntsCriterio: 'lucro' | 'xp';
  huntsAteNivelAtivo: boolean;
  timePokemon: string;
  timeCriterio: 'xp' | 'gold';
  historicoHunt: string;
  metas: Record<string, number>;
}

export const FILTROS_PADRAO: Readonly<FiltrosUi> = Object.freeze({
  huntsCriterio: 'lucro',
  huntsAteNivelAtivo: false,
  timePokemon: '',
  timeCriterio: 'xp',
  historicoHunt: '',
  metas: Object.freeze({}) as Record<string, number>,
});

export interface PreferenciasUi {
  posicao: Posicao | null;
  minimizado: boolean;
  aba: AbaPainel;
  backupAutomatico: boolean;
  tamanho: number;
  filtros: FiltrosUi;
}

export const PREFERENCIAS_PADRAO: Readonly<PreferenciasUi> = Object.freeze({
  posicao: null,
  minimizado: false,
  aba: 'sessao',
  backupAutomatico: true,
  tamanho: 0,
  filtros: FILTROS_PADRAO,
});

const MAX_TEXTO_FILTRO = 100;
const MAX_NIVEL_META = 1_000_000;
const textoFiltro = z.string().max(MAX_TEXTO_FILTRO);
const nivelMeta = z.number().int().positive().max(MAX_NIVEL_META);

function lerMetas(bruto: unknown): Record<string, number> {
  if (typeof bruto !== 'object' || bruto === null) return {};
  const metas: Record<string, number> = {};
  for (const [chave, valor] of Object.entries(bruto)) {
    const nivel = nivelMeta.safeParse(valor);
    if (nivel.success && chave.length <= MAX_TEXTO_FILTRO) metas[chave] = nivel.data;
  }
  return metas;
}

const esquemaFiltros = z
  .object({
    huntsCriterio: z.enum(['lucro', 'xp']).catch('lucro'),
    huntsAteNivelAtivo: z.boolean().catch(false),
    timePokemon: textoFiltro.catch(''),
    timeCriterio: z.enum(['xp', 'gold']).catch('xp'),
    historicoHunt: textoFiltro.catch(''),
    metas: z.unknown().optional(),
  })
  .transform((f) => ({ ...f, metas: lerMetas(f.metas) }));

const coordenada = z.number().finite();
const esquema = z.object({
  posicao: z.object({ x: coordenada, y: coordenada }).nullable().catch(null),
  minimizado: z.boolean().catch(false),
  aba: z.enum(ABAS_PAINEL).catch('sessao'),
  backupAutomatico: z.boolean().catch(true),
  tamanho: z
    .number()
    .int()
    .min(0)
    .max(TAMANHOS_PAINEL.length - 1)
    .catch(0),
  filtros: z.unknown().optional(),
});

function lerFiltros(bruto: unknown): FiltrosUi {
  return esquemaFiltros.parse(typeof bruto === 'object' && bruto !== null ? bruto : {});
}

export function lerPreferencias(bruto: unknown): PreferenciasUi {
  const res = esquema.safeParse(typeof bruto === 'object' && bruto !== null ? bruto : {});
  return res.success
    ? {
        posicao: res.data.posicao ?? null,
        minimizado: res.data.minimizado,
        aba: res.data.aba,
        backupAutomatico: res.data.backupAutomatico,
        tamanho: res.data.tamanho,
        filtros: lerFiltros(res.data.filtros),
      }
    : { ...PREFERENCIAS_PADRAO, filtros: { ...FILTROS_PADRAO, metas: {} } };
}

export interface Dimensoes {
  largura: number;
  altura: number;
}

export function limitarPosicao(p: Posicao, painel: Dimensoes, tela: Dimensoes): Posicao {
  const maxX = Math.max(0, tela.largura - painel.largura);
  const maxY = Math.max(0, tela.altura - painel.altura);
  return {
    x: Math.min(Math.max(0, p.x), maxX),
    y: Math.min(Math.max(0, p.y), maxY),
  };
}
