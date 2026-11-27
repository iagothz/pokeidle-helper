import type { ParametrosCombate } from '../domain/parametros';
import { mediana } from './taxas';

export const AMOSTRA_CALIBRACAO_MS = 5 * 60_000;
const FATOR_MINIMO = 0.05;
const FATOR_MAXIMO = 20;

export interface AmostraCalibracao {
  abatesReais: number;
  msAtivo: number;
  abatesHSimulado: number;
}

export interface Calibracao {
  fator: number;
  sessoes: number;
  componentes?: Componentes | null;
  ajustes?: Partial<ParametrosCombate>;
}

export function calibrar(amostras: readonly AmostraCalibracao[]): Calibracao | null {
  const razoes = amostras
    .filter((a) => a.msAtivo >= AMOSTRA_CALIBRACAO_MS && a.abatesHSimulado > 0)
    .map((a) => a.abatesReais / (a.msAtivo / 3_600_000) / a.abatesHSimulado);
  const m = mediana(razoes);
  if (m === null) return null;
  return { fator: Math.min(FATOR_MAXIMO, Math.max(FATOR_MINIMO, m)), sessoes: razoes.length };
}

export interface AmostraComponentes {
  abatesReais: number;
  msAtivo: number;
  golpesReais: number;
  golpesSimulados: number;
  deslocamentoMs: number;
  esperaMs: number;
  ondas: number;
}

export interface Componentes {
  fatorDano: number | null;
  deslocamentoPorAbateS: number | null;
  esperaPorOndaS: number | null;
  sessoes: number;
}

export function calibrarComponentes(amostras: readonly AmostraComponentes[]): Componentes | null {
  const validas = amostras.filter((a) => a.msAtivo >= AMOSTRA_CALIBRACAO_MS && a.abatesReais > 0);
  if (validas.length === 0) return null;
  const danos = validas
    .filter((a) => a.golpesReais > 0 && a.golpesSimulados > 0)
    .map((a) => a.golpesSimulados / a.abatesReais / (a.golpesReais / a.abatesReais));
  const comFases = validas.filter((a) => a.deslocamentoMs + a.esperaMs > 0);
  const abates = comFases.reduce((s, a) => s + a.abatesReais, 0);
  const deslocamento = comFases.reduce((s, a) => s + a.deslocamentoMs, 0);
  const comOndas = validas.filter((a) => a.ondas > 0);
  const ondas = comOndas.reduce((s, a) => s + a.ondas, 0);
  const espera = comOndas.reduce((s, a) => s + a.esperaMs, 0);
  return {
    fatorDano: mediana(danos),
    deslocamentoPorAbateS: deslocamento > 0 ? deslocamento / abates / 1000 : null,
    esperaPorOndaS: ondas > 0 ? espera / ondas / 1000 : null,
    sessoes: validas.length,
  };
}
