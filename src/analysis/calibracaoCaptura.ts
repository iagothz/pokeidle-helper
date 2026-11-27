import type { Sessao } from '../domain/sessao';

export const CAPTURAS_PRIOR = 3;
const Z95 = 1.96;

export interface AmostraCaptura {
  huntSlug: string;
  bolaId: number;
  arremessos: number;
  capturas: number;
}

export interface ContagemCaptura {
  arremessos: number;
  capturas: number;
}

export interface ChanceCalibrada {
  formula: number | null;
  medida: number | null;
  intervalo: [number, number] | null;
  calibrada: number | null;
  arremessos: number;
  capturas: number;
}

function capturasPorBola(s: Sessao): Map<number, number> | null {
  const tipos = Object.entries(s.bolas).filter(([, q]) => q > 0);
  const r = new Map<number, number>();
  if (tipos.length === 1) {
    const [id] = tipos[0] ?? [];
    if (id !== undefined) r.set(Number(id), s.capturas);
    return r;
  }
  if (tipos.length === 0) return r;
  const consumo = s.consumo ?? [];
  if (!consumo.some((c) => c.k === 'bola')) return null;
  let ultima: number | undefined;
  for (const c of consumo.toSorted((a, b) => a.t - b.t)) {
    if (c.k === 'bola' && c.id !== undefined) ultima = c.id;
    else if (c.k === 'captura' && ultima !== undefined) r.set(ultima, (r.get(ultima) ?? 0) + 1);
  }
  return r;
}

export function amostrasDeCaptura(sessoes: Iterable<Sessao>): AmostraCaptura[] {
  const porChave = new Map<string, AmostraCaptura>();
  for (const s of sessoes) {
    const capturas = capturasPorBola(s);
    if (!capturas) continue;
    for (const [id, q] of Object.entries(s.bolas)) {
      if (!(q > 0)) continue;
      const bolaId = Number(id);
      const chave = `${s.huntSlug}|${bolaId}`;
      const a = porChave.get(chave) ?? { huntSlug: s.huntSlug, bolaId, arremessos: 0, capturas: 0 };
      a.arremessos += q;
      a.capturas += capturas.get(bolaId) ?? 0;
      porChave.set(chave, a);
    }
  }
  return [...porChave.values()].toSorted(
    (a, b) => a.huntSlug.localeCompare(b.huntSlug) || a.bolaId - b.bolaId,
  );
}

export function intervaloWilson(capturas: number, arremessos: number): [number, number] | null {
  if (arremessos <= 0) return null;
  const p = capturas / arremessos;
  const z2 = Z95 * Z95;
  const den = 1 + z2 / arremessos;
  const centro = (p + z2 / (2 * arremessos)) / den;
  const margem = (Z95 * Math.sqrt((p * (1 - p)) / arremessos + z2 / (4 * arremessos ** 2))) / den;
  return [Math.max(0, centro - margem), Math.min(1, centro + margem)];
}

export function fatorGlobalCaptura(
  amostras: readonly AmostraCaptura[],
  formulaDe: (huntSlug: string, bolaId: number) => number | null,
): { fator: number; capturas: number; esperadas: number } {
  let capturas = 0;
  let esperadas = 0;
  for (const a of amostras) {
    const p = formulaDe(a.huntSlug, a.bolaId);
    if (p === null || !(p > 0) || p >= 1) continue;
    capturas += a.capturas;
    esperadas += a.arremessos * p;
  }
  if (esperadas <= 0) return { fator: 1, capturas, esperadas };
  return {
    fator: (capturas + CAPTURAS_PRIOR) / (esperadas + CAPTURAS_PRIOR),
    capturas,
    esperadas,
  };
}

export function calibrarChance(
  formula: number | null,
  amostra: ContagemCaptura | undefined,
  fatorGlobal: number,
): ChanceCalibrada {
  const arremessos = amostra?.arremessos ?? 0;
  const capturas = amostra?.capturas ?? 0;
  const medida = arremessos > 0 ? capturas / arremessos : null;
  const intervalo = intervaloWilson(capturas, arremessos);
  const base = { formula, medida, intervalo, arremessos, capturas };
  if (formula !== null && formula >= 1) return { ...base, calibrada: 1 };
  if (formula === null || !(formula > 0)) return { ...base, calibrada: medida };
  const prior = Math.min(1, formula * fatorGlobal);
  return {
    ...base,
    calibrada: (capturas + CAPTURAS_PRIOR) / (arremessos + CAPTURAS_PRIOR / prior),
  };
}
