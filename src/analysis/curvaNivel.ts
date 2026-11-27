import type { Trecho } from '../domain/coletaDetalhada';
import type { Sessao } from '../domain/sessao';
import { faixaEm, type FaixaBonus } from './multiplicadores';
import {
  FOLGA_NIVEL_POKEMON,
  horasParaGanhar,
  xpDoNivelSeguinte,
  xpTotalDoNivel,
  type Eta,
} from './progressao';

export const AMOSTRA_MINIMA_NIVEIS = 5;
export const ABATES_MINIMOS_POR_NIVEL = 20;
export const SALTOS_PROJECAO = [1, 5, 10, 20, 50, 100] as const;
const EXCESSO_MINIMO_GOLPES = 0.01;
const MS_HORA = 3_600_000;

export interface Reta {
  a: number;
  b: number;
  r2: number;
}

export interface CurvaNivel {
  golpes: Reta;
  ciclo: Reta;
  xpPorAbate: number;
  ouroPorAbate: number;
  amostra: { niveis: number; abates: number; nivelMin: number; nivelMax: number };
}

export interface RitmoNivel {
  level: number;
  golpesPorAbate: number;
  abatesH: number;
  xpH: number;
  goldH: number;
}

export interface LinhaProjecao extends RitmoNivel {
  msAte: number | null;
}

export interface Projecao {
  atual: RitmoNivel;
  linhas: LinhaProjecao[];
  teto: { abatesH: number; xpH: number; goldH: number };
  fracaoTeto: number;
  limiteNivel: number | null;
}

interface PontoNivel {
  level: number;
  abates: number;
  golpes: number;
  ms: number;
}

function agruparPorNivel(trechos: readonly Trecho[]): PontoNivel[] {
  const porNivel = new Map<number, PontoNivel>();
  for (const t of trechos) {
    if (t.level === undefined || t.abates <= 0 || t.msAtivo <= 0) continue;
    const p = porNivel.get(t.level) ?? { level: t.level, abates: 0, golpes: 0, ms: 0 };
    p.abates += t.abates;
    p.golpes += t.golpesDados;
    p.ms += t.msAtivo;
    porNivel.set(t.level, p);
  }
  return [...porNivel.values()]
    .filter((p) => p.abates >= ABATES_MINIMOS_POR_NIVEL)
    .toSorted((a, b) => a.level - b.level);
}

interface Par {
  x: number;
  y: number;
  w: number;
}

const somar = (ps: readonly Par[], f: (p: Par) => number) => ps.reduce((s, p) => s + p.w * f(p), 0);

function retaPonderada(ps: readonly Par[], inclinacao: 'neg' | 'pos'): Reta {
  const W = somar(ps, () => 1);
  const mx = somar(ps, (p) => p.x) / W;
  const my = somar(ps, (p) => p.y) / W;
  const sxx = somar(ps, (p) => (p.x - mx) ** 2);
  const sxy = somar(ps, (p) => (p.x - mx) * (p.y - my));
  const b = sxx > 0 ? sxy / sxx : 0;
  if (inclinacao === 'neg' ? b >= 0 : b <= 0) return { a: my, b: 0, r2: 0 };
  const a = my - b * mx;
  const syy = somar(ps, (p) => (p.y - my) ** 2);
  const res = somar(ps, (p) => (p.y - a - b * p.x) ** 2);
  return { a, b, r2: syy > 0 ? 1 - res / syy : 1 };
}

function maisRecente(trechos: readonly Trecho[]): Trecho | undefined {
  return trechos
    .filter((t) => t.abates > 0)
    .reduce<Trecho | undefined>((m, t) => (!m || t.fim >= m.fim ? t : m), undefined);
}

export function ajustarCurvaNivel(trechos: readonly Trecho[]): CurvaNivel | null {
  const pontos = agruparPorNivel(trechos);
  const primeiro = pontos[0];
  const ultimo = pontos.at(-1);
  const recente = maisRecente(trechos);
  if (pontos.length < AMOSTRA_MINIMA_NIVEIS || !primeiro || !ultimo || !recente) return null;
  const golpesDe = (p: PontoNivel) => p.golpes / p.abates;
  const golpes = pontos.map((p) => ({
    x: p.level,
    y: Math.log(Math.max(EXCESSO_MINIMO_GOLPES, golpesDe(p) - 1)),
    w: p.abates,
  }));
  const ciclos = pontos.map((p) => ({ x: golpesDe(p), y: p.ms / 1000 / p.abates, w: p.abates }));
  return {
    golpes: retaPonderada(golpes, 'neg'),
    ciclo: retaPonderada(ciclos, 'pos'),
    xpPorAbate: recente.xpPokemon / recente.abates,
    ouroPorAbate: recente.gold / recente.abates,
    amostra: {
      niveis: pontos.length,
      abates: pontos.reduce((s, p) => s + p.abates, 0),
      nivelMin: primeiro.level,
      nivelMax: ultimo.level,
    },
  };
}

function golpesNoNivel(c: CurvaNivel, level: number): number {
  return 1 + Math.exp(c.golpes.a + c.golpes.b * level);
}

function ritmoComGolpes(c: CurvaNivel, golpes: number) {
  const abatesH = 3600 / (c.ciclo.a + c.ciclo.b * golpes);
  return { abatesH, xpH: abatesH * c.xpPorAbate, goldH: abatesH * c.ouroPorAbate };
}

export function ritmoNoNivel(c: CurvaNivel, level: number): RitmoNivel {
  const golpesPorAbate = golpesNoNivel(c, level);
  return { level, golpesPorAbate, ...ritmoComGolpes(c, golpesPorAbate) };
}

function niveisAlvo(nivel: number, limite: number | null): number[] {
  const alvos = SALTOS_PROJECAO.map((s) => nivel + s).filter((l) => limite === null || l <= limite);
  if (limite !== null && limite > nivel && !alvos.includes(limite)) alvos.push(limite);
  return alvos;
}

export interface BonusNoTempo {
  xpBasePorAbate: number;
  faixas: readonly FaixaBonus[];
}

function horasNoNivel(c: CurvaNivel, lv: number, falta: number, bonus?: BonusNoTempo, desde = 0) {
  const r = ritmoNoNivel(c, lv);
  if (!bonus) return r.xpH > 0 ? falta / r.xpH : Infinity;
  return horasParaGanhar(falta, r.abatesH * bonus.xpBasePorAbate, bonus.faixas, 'xpPokemon', desde);
}

export function projetarProgressao(
  c: CurvaNivel,
  pokemon: { nivel: number; xp: number | undefined },
  limiteNivel: number | null,
  bonus?: BonusNoTempo,
): Projecao {
  const atual = ritmoNoNivel(c, pokemon.nivel);
  const jaGanho = Math.max(
    0,
    (pokemon.xp ?? xpTotalDoNivel(pokemon.nivel)) - xpTotalDoNivel(pokemon.nivel),
  );
  const alvos = niveisAlvo(pokemon.nivel, limiteNivel);
  const linhas: LinhaProjecao[] = [];
  let horas = 0;
  for (let lv = pokemon.nivel, i = 0; i < alvos.length; lv++) {
    const falta =
      xpDoNivelSeguinte(lv) - (lv === pokemon.nivel ? Math.min(jaGanho, xpDoNivelSeguinte(lv)) : 0);
    horas += horasNoNivel(c, lv, falta, bonus, horas);
    if (lv + 1 === alvos[i]) {
      linhas.push({
        ...ritmoNoNivel(c, lv + 1),
        msAte: Number.isFinite(horas) ? horas * MS_HORA : null,
      });
      i++;
    }
  }
  const teto = ritmoComGolpes(c, 1);
  return {
    atual,
    linhas,
    teto,
    fracaoTeto: teto.abatesH > 0 ? atual.abatesH / teto.abatesH : 0,
    limiteNivel,
  };
}

const arred = (v: number, casas: number) => Math.round(v * 10 ** casas) / 10 ** casas;

export function resumirCurva(c: CurvaNivel | null) {
  if (!c) return null;
  return {
    niveis: c.amostra.niveis,
    nivelMin: c.amostra.nivelMin,
    nivelMax: c.amostra.nivelMax,
    golpesA: arred(c.golpes.a, 4),
    golpesB: arred(c.golpes.b, 5),
    golpesR2: arred(c.golpes.r2, 3),
    cicloA: arred(c.ciclo.a, 3),
    cicloB: arred(c.ciclo.b, 3),
    cicloR2: arred(c.ciclo.r2, 3),
    tetoAbatesH: Math.round(ritmoComGolpes(c, 1).abatesH),
  };
}

export function trechosDaHunt(
  salvas: Iterable<Sessao>,
  aoVivo: Sessao | null,
  filtro: { huntSlug: string; pokemonId: string; tipoSazonal: string | null | undefined },
): Trecho[] {
  const sessoes = [...salvas].filter((s) => s.id !== aoVivo?.id);
  if (aoVivo) sessoes.push(aoVivo);
  return sessoes
    .filter((s) => s.huntSlug === filtro.huntSlug)
    .flatMap((s) => s.trechos ?? [])
    .filter(
      (t) =>
        t.pokemonId === filtro.pokemonId &&
        (filtro.tipoSazonal === undefined ||
          (t.tipoSazonal ?? null) === (filtro.tipoSazonal ?? null)),
    );
}

const MAX_PASSOS_ETA = 200_000;

export interface EstadoEta {
  quem: 'treinador' | 'pokemon';
  alvo: number;
  treinador: { nivel: number; xp: number | undefined };
  pokemon: { nivel: number; xp: number | undefined };
  xpBasePorAbate: number;
  faixas: readonly FaixaBonus[];
}

const nivelDoXp = (nivel: number, xp: number) => {
  let n = nivel;
  while (xp >= xpTotalDoNivel(n + 1)) n++;
  return n;
};

export function etaPelaCurva(c: CurvaNivel, e: EstadoEta): Eta {
  let xpT = Math.max(e.treinador.xp ?? 0, xpTotalDoNivel(e.treinador.nivel));
  let xpP = Math.max(e.pokemon.xp ?? 0, xpTotalDoNivel(e.pokemon.nivel));
  let nT = e.treinador.nivel;
  let nP = e.pokemon.nivel;
  const alvoXp = xpTotalDoNivel(e.alvo);
  const atualXp = () => (e.quem === 'treinador' ? xpT : xpP);
  const faltam = Math.max(0, alvoXp - atualXp());
  if (faltam === 0) return { faltam, msAte: 0 };
  let horas = 0;
  for (let passo = 0; passo < MAX_PASSOS_ETA && atualXp() < alvoXp; passo++) {
    const { faixa, restante } = faixaEm(e.faixas, horas);
    const xpHBase = ritmoNoNivel(c, nP).abatesH * e.xpBasePorAbate;
    const xpHP = xpHBase * faixa.xpPokemon;
    const xpHT = xpHBase * faixa.xpTreinador;
    if (!(xpHP > 0) || !(xpHT > 0)) return { faltam, msAte: null };
    const travado = nP >= nT + FOLGA_NIVEL_POKEMON;
    const dtT =
      (Math.min(xpTotalDoNivel(nT + 1), e.quem === 'treinador' ? alvoXp : Infinity) - xpT) / xpHT;
    const dtP = travado
      ? Infinity
      : (Math.min(xpTotalDoNivel(nP + 1), e.quem === 'pokemon' ? alvoXp : Infinity) - xpP) / xpHP;
    const dt = Math.max(0, Math.min(dtT, dtP, restante));
    horas += dt;
    xpT += dt * xpHT;
    if (!travado) xpP += dt * xpHP;
    nT = nivelDoXp(nT, xpT + 1e-6);
    nP = Math.min(nivelDoXp(nP, xpP + 1e-6), nT + FOLGA_NIVEL_POKEMON);
  }
  return { faltam, msAte: atualXp() >= alvoXp - 1e-6 ? horas * MS_HORA : null };
}
