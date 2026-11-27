import type { Sessao } from '../domain/sessao';

export const MS_MINIMO_RITMO = 60_000;

export interface Precos {
  bola(id: number): number;
  item(id: number): number;
}

export interface Custos {
  bolas: number;
  pocoes: number;
  revives: number;
  total: number;
}

export interface Taxas {
  msAtivo: number;
  xpTreinadorH: number;
  xpPokemonH: number;
  goldH: number;
  abatesH: number;
  abatesMin: number;
  custoH: number;
  lucroLiquidoH: number;
  vendasAutoH: number;
  lucroRealH: number;
  custoPorAbate: number;
  custos: Custos;
}

type Contadores = Pick<
  Sessao,
  | 'msAtivo'
  | 'xpTreinador'
  | 'xpPokemon'
  | 'gold'
  | 'abates'
  | 'bolas'
  | 'pocoes'
  | 'revives'
  | 'drops'
> & { vendasAuto?: number };

const somaPreco = (mapa: Record<string, number>, preco: (id: number) => number) =>
  Object.entries(mapa).reduce((t, [id, qtd]) => t + Math.max(0, preco(Number(id)) || 0) * qtd, 0);

export function custosDe(
  c: Pick<Contadores, 'bolas' | 'pocoes' | 'revives'>,
  precos: Precos,
): Custos {
  const bolas = somaPreco(c.bolas, precos.bola);
  const pocoes = somaPreco(c.pocoes, precos.item);
  const revives = somaPreco(c.revives, precos.item);
  return { bolas, pocoes, revives, total: bolas + pocoes + revives };
}

export function taxasDe(c: Contadores, precos: Precos): Taxas {
  const horas = Math.max(c.msAtivo, MS_MINIMO_RITMO) / 3_600_000;
  const custos = custosDe(c, precos);
  const porHora = (v: number) => v / horas;
  return {
    msAtivo: c.msAtivo,
    xpTreinadorH: porHora(c.xpTreinador),
    xpPokemonH: porHora(c.xpPokemon),
    goldH: porHora(c.gold),
    abatesH: porHora(c.abates),
    abatesMin: porHora(c.abates) / 60,
    custoH: porHora(custos.total),
    lucroLiquidoH: porHora(c.gold - custos.total),
    vendasAutoH: porHora(c.vendasAuto ?? 0),
    lucroRealH: porHora(c.gold + (c.vendasAuto ?? 0) - custos.total),
    custoPorAbate: c.abates > 0 ? custos.total / c.abates : 0,
    custos,
  };
}

function somarMapa(destino: Record<string, number>, origem: Record<string, number>) {
  for (const [k, v] of Object.entries(origem)) destino[k] = (destino[k] ?? 0) + v;
}

export function agregar(sessoes: readonly Sessao[]): Contadores & { sessoes: number } {
  const total: Contadores & { sessoes: number } = {
    sessoes: sessoes.length,
    msAtivo: 0,
    xpTreinador: 0,
    xpPokemon: 0,
    gold: 0,
    abates: 0,
    bolas: {},
    pocoes: {},
    revives: {},
    drops: {},
    vendasAuto: 0,
  };
  for (const s of sessoes) {
    total.vendasAuto = (total.vendasAuto ?? 0) + (s.vendasAuto ?? 0);
    total.msAtivo += s.msAtivo;
    total.xpTreinador += s.xpTreinador;
    total.xpPokemon += s.xpPokemon;
    total.gold += s.gold;
    total.abates += s.abates;
    somarMapa(total.bolas, s.bolas);
    somarMapa(total.pocoes, s.pocoes);
    somarMapa(total.revives, s.revives);
    for (const [k, d] of Object.entries(s.drops)) {
      const atual = total.drops[k] ?? { qtd: 0, ...(d.nome ? { nome: d.nome } : {}) };
      atual.qtd += d.qtd;
      total.drops[k] = atual;
    }
  }
  return total;
}

export function mediana(valores: readonly number[]): number | null {
  const v = valores.filter(Number.isFinite).toSorted((a, b) => a - b);
  if (v.length === 0) return null;
  const meio = Math.floor(v.length / 2);
  const alto = v[meio] ?? 0;
  return v.length % 2 ? alto : ((v[meio - 1] ?? alto) + alto) / 2;
}
