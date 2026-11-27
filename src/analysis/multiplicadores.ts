export const VIP_MULT_XP = 1.5;
export const BOOST_GUILD_MULT = 1.1;

export interface TipoBoost {
  chave: string;
  mult: number;
}

export interface EntradaMultiplicadores {
  agora: number;
  tiposBoost: readonly TipoBoost[];
  loja?: { vipAte?: number | undefined; boosts?: Readonly<Record<string, number>> | undefined };
  guildBonusPct?: number | undefined;
  guildBoostAte?: number | undefined;
  farmEventoPct?: number | undefined;
}

export type BonusAtivo = { rotulo: string; mult: number } | { rotulo: string; pct: number };

export interface Multiplicadores {
  xpTreinador: number;
  xpPokemon: number;
  bonusLootPct: number;
  ativos: BonusAtivo[];
}

export const MULTIPLICADORES_NEUTROS: Readonly<Multiplicadores> = Object.freeze({
  xpTreinador: 1,
  xpPokemon: 1,
  bonusLootPct: 0,
  ativos: [],
});

const ROTULOS_BOOST: Record<string, string> = {
  xp: 'boost XP treinador',
  pokexp: 'boost XP pokémon',
  loot: 'boost loot',
};

export function calcularMultiplicadores(e: EntradaMultiplicadores): Multiplicadores {
  const ativos: BonusAtivo[] = [];
  const vigente = (ate: number | undefined) => (Number(ate) || 0) > e.agora;
  const boost = (chave: string) => {
    if (!vigente(e.loja?.boosts?.[chave])) return 1;
    const mult = e.tiposBoost.find((b) => b.chave === chave)?.mult ?? 1;
    return Number.isFinite(mult) && mult > 0 ? mult : 1;
  };

  const vip = vigente(e.loja?.vipAte) ? VIP_MULT_XP : 1;
  if (vip !== 1) ativos.push({ rotulo: 'VIP', mult: vip });
  const boosts = { xp: boost('xp'), pokexp: boost('pokexp'), loot: boost('loot') };
  for (const [chave, mult] of Object.entries(boosts))
    if (mult !== 1) ativos.push({ rotulo: ROTULOS_BOOST[chave] ?? chave, mult });
  const guildPct = Math.max(0, Number(e.guildBonusPct) || 0);
  if (guildPct > 0) ativos.push({ rotulo: 'guild', pct: guildPct });
  const boostGuild = vigente(e.guildBoostAte) ? BOOST_GUILD_MULT : 1;
  if (boostGuild !== 1) ativos.push({ rotulo: 'boost da guild', mult: boostGuild });
  const farmPct = Math.max(0, Number(e.farmEventoPct) || 0);
  if (farmPct > 0) ativos.push({ rotulo: 'evento de farm', pct: farmPct });

  const comum = vip * (1 + guildPct / 100) * boostGuild;
  return {
    xpTreinador: boosts.xp * comum,
    xpPokemon: boosts.pokexp * comum,
    bonusLootPct: (boosts.loot - 1) * 100 + guildPct + farmPct,
    ativos,
  };
}
