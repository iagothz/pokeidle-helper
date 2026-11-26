import type { TabelaTipos } from '../domain/schemas';

const DIAGONAL: Readonly<Record<string, number>> = Object.freeze({
  FIRE: 0.5,
  WATER: 0.5,
  ELECTRIC: 0.5,
  GRASS: 0.5,
  ICE: 0.5,
  POISON: 0.5,
  PSYCHIC: 0.5,
  DARK: 0.5,
  STEEL: 0.5,
  GHOST: 2,
  DRAGON: 2,
});

function contra(atq: string, def: string, linha: Readonly<Record<string, number>>): number {
  const a = atq.toUpperCase();
  const d = def.toUpperCase();
  if (a === d) return DIAGONAL[a] ?? 1;
  return linha[d] ?? 1;
}

export function efetividade(atq: string, defesa: readonly string[], tabela: TabelaTipos): number {
  const linha = tabela[atq.toUpperCase()] ?? {};
  const [d1, d2] = defesa;
  if (!d1) return 1;
  let v = contra(atq, d1, linha);
  if (d2 && d2.toUpperCase() !== d1.toUpperCase()) v *= contra(atq, d2, linha);
  return v;
}

export function melhorEfetividade(
  tiposAtaque: readonly string[],
  defesa: readonly string[],
  tabela: TabelaTipos,
): number {
  if (tiposAtaque.length === 0) return 1;
  return Math.max(...tiposAtaque.map((t) => efetividade(t, defesa, tabela)));
}
