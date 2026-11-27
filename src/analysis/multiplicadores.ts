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

export type BonusAtivo =
  { rotulo: string; mult: number; ate?: number } | { rotulo: string; pct: number; ate?: number };

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

export interface FaixaBonus {
  horas: number;
  xpTreinador: number;
  xpPokemon: number;
}

export const FAIXA_NEUTRA: Readonly<FaixaBonus> = Object.freeze({
  horas: Infinity,
  xpTreinador: 1,
  xpPokemon: 1,
});

const MS_HORA = 3_600_000;

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
  if (vip !== 1) ativos.push({ rotulo: 'VIP', mult: vip, ate: Number(e.loja?.vipAte) });
  const boosts = { xp: boost('xp'), pokexp: boost('pokexp'), loot: boost('loot') };
  for (const [chave, mult] of Object.entries(boosts))
    if (mult !== 1)
      ativos.push({
        rotulo: ROTULOS_BOOST[chave] ?? chave,
        mult,
        ate: Number(e.loja?.boosts?.[chave]),
      });
  const guildPct = Math.max(0, Number(e.guildBonusPct) || 0);
  if (guildPct > 0) ativos.push({ rotulo: 'guild', pct: guildPct });
  const boostGuild = vigente(e.guildBoostAte) ? BOOST_GUILD_MULT : 1;
  if (boostGuild !== 1)
    ativos.push({ rotulo: 'boost da guild', mult: boostGuild, ate: Number(e.guildBoostAte) });
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

function vencimentosFuturos(e: EntradaMultiplicadores): number[] {
  const candidatos = [e.loja?.vipAte, e.guildBoostAte, ...Object.values(e.loja?.boosts ?? {})];
  const futuros = candidatos.map(Number).filter((t) => Number.isFinite(t) && t > e.agora);
  return [...new Set(futuros)].toSorted((a, b) => a - b);
}

export function faixasDeBonus(e: EntradaMultiplicadores): FaixaBonus[] {
  const inicios = [e.agora, ...vencimentosFuturos(e)];
  return inicios.map((inicio, i) => {
    const m = calcularMultiplicadores({ ...e, agora: inicio });
    const fim = inicios[i + 1];
    return {
      horas: fim === undefined ? Infinity : (fim - inicio) / MS_HORA,
      xpTreinador: m.xpTreinador,
      xpPokemon: m.xpPokemon,
    };
  });
}

export function faixaEm(
  faixas: readonly FaixaBonus[],
  horas: number,
): { faixa: FaixaBonus; restante: number } {
  let inicio = 0;
  for (const faixa of faixas) {
    const fim = inicio + faixa.horas;
    if (horas < fim) return { faixa, restante: fim - horas };
    inicio = fim;
  }
  return { faixa: faixas.at(-1) ?? FAIXA_NEUTRA, restante: Infinity };
}
