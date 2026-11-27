import type { Trecho } from '../domain/coletaDetalhada';
import type { Sessao } from '../domain/sessao';
import { ajustarCurvaNivel } from './curvaNivel';

export const CAPTURAS_MINIMAS = 3;
export const ABATES_MINIMOS_COM_BOLA = 50;

export type PendenciaAutocatch = 'semBolas' | 'poucasCapturas' | 'semVenda' | 'semTempo';

export interface EntradaAutocatch {
  sessoes: readonly Sessao[];
  precoBola: (id: number) => number;
  xpPorAbate: number;
  ouroPorAbate: number;
  abatesHSem: number;
  chanceCalibrada: number | null;
  pokemonId?: string | undefined;
}

export interface AnaliseAutocatch {
  amostra: { bolas: number; capturas: number; capturasVendidas: number; abatesComBola: number };
  bolasPorCaptura: number | null;
  fonteBolasPorCaptura: 'medido' | 'estimado' | null;
  bolasPorAbate: number | null;
  custoPorBola: number;
  valorPorCaptura: number | null;
  segundosExtrasPorAbate: number | null;
  abatesHSem: number;
  abatesHCom: number;
  gold: { vendasH: number; bolasH: number; abatesPerdidosH: number; liquidoH: number } | null;
  deltaXpH: number;
  pendencias: PendenciaAutocatch[];
}

interface TrechoClassificado {
  trecho: Trecho;
  comBola: boolean;
}

function classificarTrechos(
  sessoes: readonly Sessao[],
  pokemonId: string | undefined,
): TrechoClassificado[] {
  return sessoes.flatMap((s) => {
    const bolas = (s.consumo ?? []).filter((c) => c.k === 'bola').map((c) => c.t);
    return (s.trechos ?? [])
      .filter((t) => pokemonId === undefined || t.pokemonId === pokemonId)
      .map((trecho) => ({
        trecho,
        comBola: bolas.some((t) => t >= trecho.inicio && t <= trecho.fim),
      }));
  });
}

function segundosExtras(classificados: readonly TrechoClassificado[]): number | null {
  const com = classificados.filter((c) => c.comBola && c.trecho.abates > 0).map((c) => c.trecho);
  const abatesCom = com.reduce((s, t) => s + t.abates, 0);
  if (abatesCom < ABATES_MINIMOS_COM_BOLA) return null;
  const curva = ajustarCurvaNivel(classificados.filter((c) => !c.comBola).map((c) => c.trecho));
  if (!curva) return null;
  const residuo = com.reduce((s, t) => {
    const previsto = curva.ciclo.a + curva.ciclo.b * (t.golpesDados / t.abates);
    return s + (t.msAtivo / 1000 - previsto * t.abates);
  }, 0);
  return Math.max(0, residuo / abatesCom);
}

function somaBolas(sessoes: readonly Sessao[], precoBola: (id: number) => number) {
  let bolas = 0;
  let custo = 0;
  let abates = 0;
  for (const s of sessoes) {
    const daSessao = Object.entries(s.bolas).reduce((n, [, q]) => n + q, 0);
    if (daSessao > 0) abates += s.abates;
    bolas += daSessao;
    for (const [id, q] of Object.entries(s.bolas)) custo += q * precoBola(Number(id));
  }
  return { bolas, custo, abates };
}

export function analisarAutocatch(e: EntradaAutocatch): AnaliseAutocatch {
  const { bolas, custo, abates } = somaBolas(e.sessoes, e.precoBola);
  const capturas = e.sessoes.reduce((s, x) => s + x.capturas, 0);
  const vendas = e.sessoes
    .flatMap((s) => s.consumo ?? [])
    .filter((c) => c.k === 'captura' && (c.v ?? 0) > 0)
    .map((c) => c.v ?? 0);
  const classificados = classificarTrechos(e.sessoes, e.pokemonId);
  const extra = segundosExtras(classificados);
  const medido = capturas >= CAPTURAS_MINIMAS && bolas > 0;
  const calibrada = e.chanceCalibrada !== null && e.chanceCalibrada > 0 ? e.chanceCalibrada : null;
  const bolasPorCaptura = calibrada !== null ? 1 / calibrada : medido ? bolas / capturas : null;
  const estimado = !medido && calibrada !== null;
  const bolasPorAbate = bolas > 0 && abates > 0 ? bolas / abates : null;
  const valorPorCaptura = vendas.length ? vendas.reduce((s, v) => s + v, 0) / vendas.length : null;
  const ciclo = e.abatesHSem > 0 ? 3600 / e.abatesHSem : 0;
  const abatesHCom = ciclo > 0 ? 3600 / (ciclo + (extra ?? 0)) : 0;
  const bolasH = bolasPorAbate !== null ? abatesHCom * bolasPorAbate : 0;
  const gold =
    bolasPorCaptura !== null && valorPorCaptura !== null && bolasPorAbate !== null
      ? (() => {
          const vendasH = (bolasH / bolasPorCaptura) * valorPorCaptura;
          const custoH = bolasH * (bolas > 0 ? custo / bolas : 0);
          const abatesPerdidosH = (e.abatesHSem - abatesHCom) * e.ouroPorAbate;
          return {
            vendasH,
            bolasH: custoH,
            abatesPerdidosH,
            liquidoH: vendasH - custoH - abatesPerdidosH,
          };
        })()
      : null;
  const pendencias: PendenciaAutocatch[] = [];
  if (bolas === 0) pendencias.push('semBolas');
  else if (!medido) pendencias.push('poucasCapturas');
  if (vendas.length === 0) pendencias.push('semVenda');
  if (extra === null) pendencias.push('semTempo');
  return {
    amostra: {
      bolas,
      capturas,
      capturasVendidas: vendas.length,
      abatesComBola: classificados
        .filter((c) => c.comBola)
        .reduce((s, c) => s + c.trecho.abates, 0),
    },
    bolasPorCaptura,
    fonteBolasPorCaptura: medido ? 'medido' : estimado ? 'estimado' : null,
    bolasPorAbate,
    custoPorBola: bolas > 0 ? custo / bolas : 0,
    valorPorCaptura,
    segundosExtrasPorAbate: extra,
    abatesHSem: e.abatesHSem,
    abatesHCom,
    gold,
    deltaXpH: (abatesHCom - e.abatesHSem) * e.xpPorAbate,
    pendencias,
  };
}
