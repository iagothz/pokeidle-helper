import { faixaEm, type FaixaBonus } from './multiplicadores';

const MS_HORA = 3_600_000;
export const FOLGA_NIVEL_POKEMON = 5;
const REFINO_CUSTO_BASE = 500;

export function xpTotalDoNivel(nivel: number): number {
  const L = Math.floor(Number(nivel) || 0);
  return L <= 1 ? 0 : Math.round((50 / 3) * (L ** 3 - 6 * L ** 2 + 17 * L - 12));
}

export function xpDoNivelSeguinte(nivel: number): number {
  return xpTotalDoNivel(nivel + 1) - xpTotalDoNivel(nivel);
}

export interface Eta {
  faltam: number;
  msAte: number | null;
}

export function etaParaNivel(xpAtual: number, nivelAlvo: number, xpPorHora: number): Eta {
  const faltam = Math.max(0, xpTotalDoNivel(nivelAlvo) - Math.max(0, xpAtual));
  if (faltam === 0) return { faltam, msAte: 0 };
  return { faltam, msAte: xpPorHora > 0 ? (faltam / xpPorHora) * MS_HORA : null };
}

export type QuemGanhaXp = 'xpTreinador' | 'xpPokemon';

export interface RitmoXp {
  xpHBase: number;
  faixas: readonly FaixaBonus[];
  quem: QuemGanhaXp;
}

export function horasParaGanhar(
  xp: number,
  xpHBase: number,
  faixas: readonly FaixaBonus[],
  quem: QuemGanhaXp,
  inicioHoras = 0,
): number {
  let falta = Math.max(0, xp);
  let horas = inicioHoras;
  while (falta > 0) {
    const { faixa, restante } = faixaEm(faixas, horas);
    const xpH = xpHBase * faixa[quem];
    if (!(xpH > 0)) return Infinity;
    const ganho = xpH * restante;
    if (ganho >= falta) return horas + falta / xpH - inicioHoras;
    falta -= ganho;
    horas += restante;
  }
  return horas - inicioHoras;
}

export function etaComBonus(xpAtual: number, nivelAlvo: number, ritmo: RitmoXp): Eta {
  const faltam = Math.max(0, xpTotalDoNivel(nivelAlvo) - Math.max(0, xpAtual));
  if (faltam === 0) return { faltam, msAte: 0 };
  const horas = horasParaGanhar(faltam, ritmo.xpHBase, ritmo.faixas, ritmo.quem);
  return { faltam, msAte: Number.isFinite(horas) ? horas * MS_HORA : null };
}

interface ComNivel {
  level?: number | undefined;
  xp?: number | undefined;
}

export interface PokemonTravado<P> {
  pokemon: P;
  nivelTreinadorNecessario: number;
  faltamXp: number;
  msAte: number | null;
}

export function pokemonsTravados<P extends { level?: number | undefined }>(
  pokemons: readonly P[],
  treinador: ComNivel,
  ritmo: RitmoXp,
): PokemonTravado<P>[] {
  const nivel = treinador.level;
  if (nivel === undefined) return [];
  const xpAtual = treinador.xp ?? xpTotalDoNivel(nivel);
  return pokemons
    .filter((p) => p.level !== undefined && p.level > nivel + FOLGA_NIVEL_POKEMON)
    .map((pokemon) => {
      const necessario = (pokemon.level ?? 0) - FOLGA_NIVEL_POKEMON;
      const eta = etaComBonus(xpAtual, necessario, ritmo);
      return {
        pokemon,
        nivelTreinadorNecessario: necessario,
        faltamXp: eta.faltam,
        msAte: eta.msAte,
      };
    })
    .toSorted((a, b) => a.nivelTreinadorNecessario - b.nivelTreinadorNecessario);
}

export interface ProgressoEvolucao {
  nivelEvolucao: number;
  faltamXp: number;
  abates: number;
  msAte: number | null;
}

export function progressoEvolucao(
  pokemon: ComNivel,
  especie: { evolveLevel: number; evolvesToId: number },
  xpPorAbate: number,
  ritmo: RitmoXp,
): ProgressoEvolucao | null {
  const alvo = especie.evolveLevel;
  if (!especie.evolvesToId || !(alvo > 0) || pokemon.xp === undefined) return null;
  if ((pokemon.level ?? 0) >= alvo) return null;
  const eta = etaComBonus(pokemon.xp, alvo, ritmo);
  return {
    nivelEvolucao: alvo,
    faltamXp: eta.faltam,
    abates: xpPorAbate > 0 ? Math.ceil(eta.faltam / xpPorAbate) : 0,
    msAte: eta.msAte,
  };
}

export function custoRefino(pontos: number): { proximo: number; investido: number } {
  const n = Math.max(0, Math.floor(Number(pontos) || 0));
  return {
    proximo: REFINO_CUSTO_BASE * (3 * n * n + 3 * n + 1),
    investido: REFINO_CUSTO_BASE * n ** 3,
  };
}
