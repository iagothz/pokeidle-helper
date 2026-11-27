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

export interface PreferenciasUi {
  posicao: Posicao | null;
  minimizado: boolean;
  aba: AbaPainel;
  backupAutomatico: boolean;
}

export const PREFERENCIAS_PADRAO: Readonly<PreferenciasUi> = Object.freeze({
  posicao: null,
  minimizado: false,
  aba: 'sessao',
  backupAutomatico: true,
});

const coordenada = z.number().finite();
const esquema = z.object({
  posicao: z.object({ x: coordenada, y: coordenada }).nullable().catch(null),
  minimizado: z.boolean().catch(false),
  aba: z.enum(ABAS_PAINEL).catch('sessao'),
  backupAutomatico: z.boolean().catch(true),
});

export function lerPreferencias(bruto: unknown): PreferenciasUi {
  const res = esquema.safeParse(typeof bruto === 'object' && bruto !== null ? bruto : {});
  return res.success
    ? {
        posicao: res.data.posicao ?? null,
        minimizado: res.data.minimizado,
        aba: res.data.aba,
        backupAutomatico: res.data.backupAutomatico,
      }
    : { ...PREFERENCIAS_PADRAO };
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
