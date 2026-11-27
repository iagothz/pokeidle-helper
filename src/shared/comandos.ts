import * as z from 'zod';

export const ORIGEM_COMANDO = 'pokeidle-helper.comando';
export const VERSAO_COMANDO = 1;

const idPositivo = z.number().int().positive().max(1_000_000_000);
const listaIds = z.array(idPositivo).max(64);
const slug = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/i);
const pokemonId = z.union([idPositivo, z.string().regex(/^\d{1,12}$/)]);

export const CAMPOS_AUTO_SET = [
  'autoBallAteCapturar',
  'autoBallSemParar',
  'autoBall',
  'ballIds',
  'autoRevive',
  'reviveIds',
  'autoPotion',
  'potionIds',
  'hpLimiar',
  'autoVoltarHunt',
  'pvpAutoFila',
] as const;

export const esquemaHuntSelect = z.strictObject({ t: z.literal('hunt.select'), slug });

export const esquemaAutoSet = z.strictObject({
  t: z.literal('auto.set'),
  autoBallAteCapturar: z.boolean().optional(),
  autoBallSemParar: z.boolean().optional(),
  autoBall: z.boolean().optional(),
  ballIds: listaIds.optional(),
  autoRevive: z.boolean().optional(),
  reviveIds: listaIds.optional(),
  autoPotion: z.boolean().optional(),
  potionIds: listaIds.optional(),
  hpLimiar: z.number().min(0).max(1).optional(),
  autoVoltarHunt: z.boolean().optional(),
  pvpAutoFila: z.boolean().optional(),
});

export const esquemaShopBuy = z.strictObject({
  t: z.literal('shop.buy'),
  kind: z.enum(['ball', 'item']),
  id: idPositivo,
  qty: z.number().int().min(1).max(10_000),
});

export const esquemaTeamActive = z.strictObject({ t: z.literal('team.active'), pokemonId });

export const esquemaComando = z.discriminatedUnion('t', [
  esquemaHuntSelect,
  esquemaAutoSet,
  esquemaShopBuy,
  esquemaTeamActive,
]);

export type Comando = z.infer<typeof esquemaComando>;
export type TipoComando = Comando['t'];
export const TIPOS_COMANDO: readonly TipoComando[] = [
  'hunt.select',
  'auto.set',
  'shop.buy',
  'team.active',
];

export const esquemaEnvelopeComando = z.strictObject({
  origem: z.literal(ORIGEM_COMANDO),
  v: z.literal(VERSAO_COMANDO),
  id: z.number().int().nonnegative(),
  comando: z.unknown(),
});
export type EnvelopeComando = z.infer<typeof esquemaEnvelopeComando>;

export type MotivoRecusa = 'invalido' | 'limite' | 'sem-conexao' | 'erro';

export interface ResultadoComando {
  id: number;
  t: string;
  enviado: boolean;
  motivo?: MotivoRecusa;
}

export interface LimitesComando {
  intervaloPorTipoMs: number;
  maximoPorMinuto: number;
}

export const LIMITES_PADRAO: Readonly<LimitesComando> = Object.freeze({
  intervaloPorTipoMs: 900,
  maximoPorMinuto: 90,
});

export class LimitadorComandos {
  private readonly ultimoPorTipo = new Map<string, number>();
  private readonly janela: number[] = [];

  constructor(private readonly limites: LimitesComando = LIMITES_PADRAO) {}

  permitir(tipo: string, agora: number): boolean {
    while (this.janela.length && agora - (this.janela[0] ?? agora) >= 60_000) this.janela.shift();
    if (this.janela.length >= this.limites.maximoPorMinuto) return false;
    const ultimo = this.ultimoPorTipo.get(tipo);
    if (ultimo !== undefined && agora - ultimo < this.limites.intervaloPorTipoMs) return false;
    this.ultimoPorTipo.set(tipo, agora);
    this.janela.push(agora);
    return true;
  }
}
