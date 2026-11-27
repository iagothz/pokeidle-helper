import type { Bases } from '../domain/catalogo';

export type ChaveStat = keyof Bases;
export type Stats = Bases;

const EXPO_QUALIDADE: Record<ChaveStat, number> = {
  hp: 0.95,
  atk: 0.8,
  def: 0.8,
  spAtk: 0.8,
  spDef: 0.8,
  speed: 0.95,
};
const BONUS_POTENCIA = [0, 0.05, 0.1, 0.25, 1];
const MULT_SHINY = 3;
const STAB = 1.5;
const ALEATORIO_MEDIO = (0.85 + 1) / 2;
const MULT_HP_COMBATE = 12;
const HP_COMBATE_MINIMO = 24;

const BANDAS_QUALIDADE = [
  [0.8, 0.9, 5],
  [0.9, 1.0, 5],
  [1.0, 1.1, 34.03846],
  [1.1, 1.2, 20],
  [1.2, 1.3, 10],
  [1.3, 1.4, 10],
  [1.4, 1.5, 10],
  [1.5, 1.6, 5],
  [1.7, 1.8, 0.67308],
  [1.8, 1.8, 0.28846],
] as const;

export const QUALIDADE_MEDIA_SELVAGEM =
  BANDAS_QUALIDADE.reduce((s, [min, max, c]) => s + ((min + max) / 2) * c, 0) /
  BANDAS_QUALIDADE.reduce((s, [, , c]) => s + c, 0);
export const IV_MEDIO = 16.5;

export type Ivs = Partial<Record<ChaveStat, number>>;

export function multDeNascenca(potencia: number | undefined, shiny: boolean | undefined): number {
  const p = Math.min(5, Math.max(1, Math.floor(Number(potencia) || 1)));
  return (1 + (BONUS_POTENCIA[p - 1] ?? 0)) * (shiny ? MULT_SHINY : 1);
}

export function statsNoNivel(
  bases: Bases,
  ivs: Ivs | number,
  nivel: number,
  qualidade: number,
  mult: number,
): Stats {
  const n = Math.max(1, Math.floor(Number(nivel) || 1));
  const q = Number(qualidade) || 1;
  const iv = (k: ChaveStat) => (typeof ivs === 'number' ? ivs : (ivs[k] ?? 1));
  const um = (k: ChaveStat) =>
    Math.round((bases[k] + 2 * iv(k)) * (n / 100) * q ** EXPO_QUALIDADE[k] * mult);
  return {
    hp: um('hp'),
    atk: um('atk'),
    def: um('def'),
    spAtk: um('spAtk'),
    spDef: um('spDef'),
    speed: um('speed'),
  };
}

export function hpDeCombate(hp: number): number {
  return Math.max(HP_COMBATE_MINIMO, Math.round(hp * MULT_HP_COMBATE));
}

export function efetividadeNaHunt(v: number, ampliacao: number): number {
  if (v === 0 || v === 1) return v;
  return v > 1 ? 1 + (v - 1) * ampliacao : v / ampliacao;
}

export interface EntradaDano {
  nivel: number;
  poder: number;
  atk: number;
  def: number;
  stab: boolean;
  ef: number;
}

export function danoMedio(e: EntradaDano): number {
  const def = Math.max(1, e.def);
  const base = (((2 * e.nivel) / 5 + 2) * e.poder * (e.atk / def)) / 50 + 2;
  return base * (e.stab ? STAB : 1) * e.ef * ALEATORIO_MEDIO;
}
