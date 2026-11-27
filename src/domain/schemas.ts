import * as z from 'zod';

const id = z.union([z.number(), z.string()]);
const numero = z.coerce.number().catch(0);

export const esquemaHunt = z.object({
  slug: z.string().min(1),
  nome: z.string().catch(''),
  nivel: z.coerce.number().catch(1),
  area: z.string().optional().catch(undefined),
  regiao: z.string().optional().catch(undefined),
  especies: z
    .array(z.object({ pokeId: z.coerce.number(), pontos: z.coerce.number().catch(1) }))
    .catch([]),
});
export type Hunt = z.infer<typeof esquemaHunt>;

export const esquemaTabelaTipos = z.record(z.string(), z.record(z.string(), z.number()));
export type TabelaTipos = z.infer<typeof esquemaTabelaTipos>;

export const esquemaBola = z.object({
  id: z.coerce.number(),
  name: z.string().optional(),
  nome: z.string().optional(),
  priceGold: z.coerce.number().optional().catch(undefined),
  catchRate: z.coerce.number().optional().catch(undefined),
});
export type Bola = z.infer<typeof esquemaBola>;

export const esquemaItem = z.object({
  id: z.coerce.number(),
  name: z.string().catch(''),
  category: z.string().optional().catch(undefined),
  npcPrice: z.coerce.number().optional().catch(undefined),
});
export type Item = z.infer<typeof esquemaItem>;

const CHAVES_STAT = ['hp', 'atk', 'def', 'spAtk', 'spDef', 'speed'] as const;

function lerStats(
  bruto: unknown,
): Partial<Record<(typeof CHAVES_STAT)[number], number>> | undefined {
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return undefined;
  const saida: Partial<Record<(typeof CHAVES_STAT)[number], number>> = {};
  for (const k of CHAVES_STAT) {
    const v = Number((bruto as Record<string, unknown>)[k]);
    if (Number.isFinite(v) && v >= 0) saida[k] = v;
  }
  return Object.keys(saida).length ? saida : undefined;
}

const mapaDeStats = z.unknown().transform(lerStats);

export const esquemaPokemon = z.object({
  id,
  speciesId: z.coerce.number().optional().catch(undefined),
  level: z.coerce.number().optional().catch(undefined),
  nome: z.string().optional().catch(undefined),
  nick: z.string().optional().catch(undefined),
  tipos: z.array(z.string()).optional().catch(undefined),
  shiny: z.boolean().optional().catch(undefined),
  xp: z.coerce.number().optional().catch(undefined),
  xpNivel: z.coerce.number().optional().catch(undefined),
  xpProximo: z.coerce.number().optional().catch(undefined),
  ivs: mapaDeStats.optional(),
  quality: z.coerce.number().positive().optional().catch(undefined),
  potencia: z.coerce.number().optional().catch(undefined),
  refino: mapaDeStats.optional(),
  stats: mapaDeStats.optional(),
  maxHp: z.coerce.number().positive().optional().catch(undefined),
  tmElemental: z
    .string()
    .transform((t) => t.toUpperCase())
    .optional()
    .catch(undefined),
  tmFisico: z.boolean().optional().catch(undefined),
  slot: z.coerce.number().nullable().optional().catch(undefined),
  tmAoe: z
    .unknown()
    .transform((v) => (v === undefined || v === null ? undefined : !!v))
    .optional(),
});
export type PokemonJogador = z.infer<typeof esquemaPokemon>;

export const esquemaJogador = z.object({
  nick: z.string().optional().catch(undefined),
  level: z.coerce.number().optional().catch(undefined),
  gold: z.coerce.number().optional().catch(undefined),
  xp: z.coerce.number().optional().catch(undefined),
  xpNivel: z.coerce.number().optional().catch(undefined),
  xpProximo: z.coerce.number().optional().catch(undefined),
  activeId: id.nullable().optional().catch(undefined),
  huntSlug: z.string().nullable().optional().catch(undefined),
  noCentro: z.boolean().optional().catch(undefined),
  pokemons: z.array(z.unknown()).optional().catch(undefined),
  items: z.unknown().optional(),
  balls: z.unknown().optional(),
});

export function lerQuantidades(bruto: unknown): Record<string, number> {
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return {};
  const saida: Record<string, number> = {};
  for (const [chave, valor] of Object.entries(bruto)) {
    const id = idPositivo(chave);
    const qtd = Number(valor);
    if (id === null || !Number.isFinite(qtd) || qtd < 0) continue;
    saida[String(id)] = Math.floor(qtd);
  }
  return saida;
}
export type JogadorBruto = z.infer<typeof esquemaJogador>;

export const esquemaWelcome = z.object({
  t: z.literal('welcome'),
  estado: z.record(z.string(), z.unknown()).optional().catch(undefined),
  hunts: z.array(z.unknown()).optional().catch(undefined),
  tabelaTipos: esquemaTabelaTipos.optional().catch(undefined),
  catalogoBolas: z.array(z.unknown()).optional().catch(undefined),
  itensNossos: z.array(z.unknown()).optional().catch(undefined),
  tiposBoost: z.array(z.unknown()).optional().catch(undefined),
  ampliacaoHunt: z.coerce.number().positive().optional().catch(undefined),
  multHpSelvagem: z.coerce.number().positive().optional().catch(undefined),
  multDanoSelvagem: z.coerce.number().positive().optional().catch(undefined),
  chanceShiny: z.coerce.number().min(0).max(1).optional().catch(undefined),
  captura: z
    .object({
      base: z.coerce.number().positive(),
      piso: z.coerce.number().min(0),
      teto: z.coerce.number().positive(),
      raridadeDiv: z.coerce.number().positive().catch(17),
    })
    .optional()
    .catch(undefined),
});

export const esquemaTipoBoost = z.object({
  chave: z.string().min(1),
  mult: z.coerce.number().positive(),
});

const instante = z.coerce.number().optional().catch(undefined);

export const esquemaBonusJogador = z.object({
  loja: z.object({ vipAte: instante, boosts: z.unknown().optional() }).optional().catch(undefined),
  guildBonusPct: instante,
  guild: z.object({ boostAte: instante }).optional().catch(undefined),
});

export const esquemaEvento = z.object({
  farmPct: z.coerce.number().catch(0),
  terminaEm: z.coerce.number().catch(0),
});

export const esquemaEstadoMsg = z.object({
  t: z.literal('estado'),
  estado: z.record(z.string(), z.unknown()),
});

export const esquemaBatalhaMsg = z.object({
  t: z.literal('batalha'),
  ev: z.array(z.unknown()),
});

const esquemaDrop = z.object({
  itemId: z.coerce.number().optional().catch(undefined),
  nome: z.string().optional().catch(undefined),
  qtd: z.coerce.number().optional().catch(undefined),
});
const drops = z.array(esquemaDrop).catch([]);

export const esquemasEvento = {
  hunt: z.object({
    k: z.literal('hunt'),
    slug: z.string().min(1),
    nome: z.string().optional().catch(undefined),
  }),
  spawn: z.object({
    k: z.literal('spawn'),
    speciesId: z.coerce.number(),
    nome: z.string().optional().catch(undefined),
    level: z.coerce.number().optional().catch(undefined),
    tipos: z.array(z.string()).optional().catch(undefined),
  }),
  morte: z.object({
    k: z.literal('morte'),
    quem: z.string(),
    xp: numero.optional(),
    xpTreinador: numero.optional(),
    xpPokemon: numero.optional(),
    ouro: numero.optional(),
    drops,
  }),
  bossMorto: z.object({
    k: z.literal('bossMorto'),
    xp: numero.optional(),
    xpTreinador: numero.optional(),
    xpPokemon: numero.optional(),
    valor: numero.optional(),
    drops,
  }),
  bola: z.object({
    k: z.literal('bola'),
    ballId: id.optional().catch(undefined),
    shiny: z.boolean().optional().catch(undefined),
  }),
  capturado: z.object({
    k: z.literal('capturado'),
    pokemon: z
      .object({ shiny: z.boolean().optional().catch(undefined) })
      .optional()
      .catch(undefined),
    vendidoAuto: numero.optional(),
  }),
  ataque: z.object({
    k: z.literal('ataque'),
    por: z.string().catch(''),
    tipo: z.string().optional().catch(undefined),
    dano: numero.optional(),
    ef: numero.optional(),
  }),
  bossEntrou: z.object({
    k: z.literal('bossEntrou'),
    entrada: z
      .object({
        itemId: id.optional().catch(undefined),
        qtd: z.coerce.number().optional().catch(undefined),
      })
      .optional()
      .catch(undefined),
  }),
  xpPerdido: z.object({ k: z.literal('xpPerdido'), qtd: numero.optional() }),
  fugiu: z.object({ k: z.literal('fugiu') }),
  cura: z.object({ k: z.literal('cura'), itemId: id.optional().catch(undefined) }),
  revive: z.object({ k: z.literal('revive'), itemId: id.optional().catch(undefined) }),
} as const;

export type TipoEvento = keyof typeof esquemasEvento;
export type Evento = { [K in TipoEvento]: z.infer<(typeof esquemasEvento)[K]> }[TipoEvento];

export function lerEvento(bruto: unknown): Evento | null | 'invalido' {
  if (!bruto || typeof bruto !== 'object') return 'invalido';
  const k = (bruto as { k?: unknown }).k;
  if (typeof k !== 'string' || !(k in esquemasEvento)) return null;
  const res = esquemasEvento[k as TipoEvento].safeParse(bruto);
  return res.success ? res.data : 'invalido';
}

export function idPositivo(v: unknown): number | null {
  const n =
    typeof v === 'string'
      ? /^\d{1,9}$/.test(v)
        ? Number(v)
        : NaN
      : typeof v === 'number'
        ? v
        : NaN;
  return Number.isInteger(n) && n > 0 && n < 1e9 ? n : null;
}
