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
});
export type Bola = z.infer<typeof esquemaBola>;

export const esquemaItem = z.object({
  id: z.coerce.number(),
  name: z.string().catch(''),
  category: z.string().optional().catch(undefined),
  npcPrice: z.coerce.number().optional().catch(undefined),
});
export type Item = z.infer<typeof esquemaItem>;

export const esquemaPokemon = z.object({
  id,
  speciesId: z.coerce.number().optional().catch(undefined),
  level: z.coerce.number().optional().catch(undefined),
  nome: z.string().optional().catch(undefined),
  nick: z.string().optional().catch(undefined),
  tipos: z.array(z.string()).optional().catch(undefined),
  shiny: z.boolean().optional().catch(undefined),
});
export type PokemonJogador = z.infer<typeof esquemaPokemon>;

export const esquemaJogador = z.object({
  nick: z.string().optional().catch(undefined),
  level: z.coerce.number().optional().catch(undefined),
  gold: z.coerce.number().optional().catch(undefined),
  activeId: id.nullable().optional().catch(undefined),
  huntSlug: z.string().nullable().optional().catch(undefined),
  noCentro: z.boolean().optional().catch(undefined),
  pokemons: z.array(z.unknown()).optional().catch(undefined),
});
export type JogadorBruto = z.infer<typeof esquemaJogador>;

export const esquemaWelcome = z.object({
  t: z.literal('welcome'),
  estado: z.record(z.string(), z.unknown()).optional().catch(undefined),
  hunts: z.array(z.unknown()).optional().catch(undefined),
  tabelaTipos: esquemaTabelaTipos.optional().catch(undefined),
  catalogoBolas: z.array(z.unknown()).optional().catch(undefined),
  itensNossos: z.array(z.unknown()).optional().catch(undefined),
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
  }),
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
