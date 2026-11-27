import { mediana } from './taxas';

export const AMOSTRA_CALIBRACAO_MS = 5 * 60_000;
const FATOR_MINIMO = 0.1;
const FATOR_MAXIMO = 5;

export interface AmostraCalibracao {
  abatesReais: number;
  msAtivo: number;
  abatesHSimulado: number;
}

export interface Calibracao {
  fator: number;
  sessoes: number;
}

export function calibrar(amostras: readonly AmostraCalibracao[]): Calibracao | null {
  const razoes = amostras
    .filter((a) => a.msAtivo >= AMOSTRA_CALIBRACAO_MS && a.abatesHSimulado > 0)
    .map((a) => a.abatesReais / (a.msAtivo / 3_600_000) / a.abatesHSimulado);
  const m = mediana(razoes);
  if (m === null) return null;
  return { fator: Math.min(FATOR_MAXIMO, Math.max(FATOR_MINIMO, m)), sessoes: razoes.length };
}
