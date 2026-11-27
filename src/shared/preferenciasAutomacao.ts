import * as z from 'zod';

export const CHAVE_PREFERENCIAS_AUTOMACAO = 'pokeidleHelper.automacao';
export const MINIMO_PADRAO = 200;
export const ALVO_PADRAO = 1000;
export const MAXIMO_REGRAS = 40;

export type KindCompra = 'ball' | 'item';
export type CriterioRotacao = 'lucro' | 'xp' | 'nivel';

export interface RegraReposicao {
  kind: KindCompra;
  id: number;
  minimo: number;
  alvo: number;
}

export interface PreferenciasAutomacao {
  ligada: boolean;
  viagem: boolean;
  autoBallDex: boolean;
  melhorAtivo: boolean;
  reposicao: { ligada: boolean; reservaGold: number; regras: RegraReposicao[] };
  rotacao: { ligada: boolean; criterio: CriterioRotacao };
}

export const PREFERENCIAS_AUTOMACAO_PADRAO: Readonly<PreferenciasAutomacao> =
  Object.freeze<PreferenciasAutomacao>({
    ligada: false,
    viagem: true,
    autoBallDex: false,
    melhorAtivo: false,
    reposicao: { ligada: false, reservaGold: 0, regras: [] },
    rotacao: { ligada: false, criterio: 'lucro' },
  });

const quantidade = z.number().int().min(0).max(1_000_000);

const esquemaRegra = z
  .object({
    kind: z.enum(['ball', 'item']),
    id: z.number().int().positive(),
    minimo: quantidade,
    alvo: quantidade,
  })
  .refine((r) => r.alvo > r.minimo);

const esquema = z.object({
  ligada: z.boolean().catch(false),
  viagem: z.boolean().catch(true),
  autoBallDex: z.boolean().catch(false),
  melhorAtivo: z.boolean().catch(false),
  reposicao: z
    .object({
      ligada: z.boolean().catch(false),
      reservaGold: z.number().min(0).max(1e15).catch(0),
      regras: z
        .array(z.unknown())
        .catch([])
        .transform((l) =>
          l
            .flatMap((r) => {
              const res = esquemaRegra.safeParse(r);
              return res.success ? [res.data] : [];
            })
            .slice(0, MAXIMO_REGRAS),
        ),
    })
    .catch({ ligada: false, reservaGold: 0, regras: [] }),
  rotacao: z
    .object({
      ligada: z.boolean().catch(false),
      criterio: z.enum(['lucro', 'xp', 'nivel']).catch('lucro'),
    })
    .catch({ ligada: false, criterio: 'lucro' }),
});

export function lerPreferenciasAutomacao(bruto: unknown): PreferenciasAutomacao {
  const base = typeof bruto === 'object' && bruto !== null ? bruto : {};
  const res = esquema.safeParse({ ...PREFERENCIAS_AUTOMACAO_PADRAO, ...base });
  if (!res.success) return structuredClone(PREFERENCIAS_AUTOMACAO_PADRAO);
  return res.data as PreferenciasAutomacao;
}

export function regraPadrao(kind: KindCompra, id: number): RegraReposicao {
  return { kind, id, minimo: MINIMO_PADRAO, alvo: ALVO_PADRAO };
}
