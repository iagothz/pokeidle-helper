import type { CatalogoEspecies, Especie, Golpe } from '../domain/catalogo';
import { PARAMETROS_COMBATE_PADRAO, type ParametrosCombate } from '../domain/parametros';
import type { Hunt, TabelaTipos } from '../domain/schemas';
import { cooldownComSpeed, intervaloGlobalMs, recargaInvestidaMs } from '../domain/cadencia';
import {
  IV_MEDIO,
  QUALIDADE_MEDIA_SELVAGEM,
  danoMedio,
  efetividadeNaHunt,
  hpDeCombate,
  statsNoNivel,
  type Ivs,
  type Stats,
} from './combate';
import { efetividade } from './tipos';

export { PARAMETROS_COMBATE_PADRAO, type ParametrosCombate };

const PODER_INVESTIDA = 30;
const PODER_Z = 2800;
const RECARGA_Z_MS = 60_000;
const INTERVALO_SELVAGEM_MS = 1400;
const MULT_SAZONAL = 2;
const MAX_MOBS = 16;

export interface Atacante {
  especie: Especie;
  nivel: number;
  ivs: Ivs | number;
  qualidade: number;
  mult: number;
  statsProntos?: Stats | undefined;
  hpCombate?: number | undefined;
  tmElemental?: string | undefined;
  tmFisico?: boolean | undefined;
  tmAoe?: boolean | undefined;
}

export interface GolpeAlocavel {
  dano: number;
  recargaMs: number;
}

export function alocarDps(
  golpes: readonly GolpeAlocavel[],
  intervaloMs: number,
): { dps: number; acoesPorSeg: number } {
  let capacidade = 1000 / Math.max(1, intervaloMs);
  let dps = 0;
  let acoesPorSeg = 0;
  for (const g of golpes.toSorted((a, b) => b.dano - a.dano)) {
    if (capacidade <= 0 || g.dano <= 0) break;
    const taxa = Math.min(1000 / Math.max(1, g.recargaMs), capacidade);
    dps += taxa * g.dano;
    acoesPorSeg += taxa;
    capacidade -= taxa;
  }
  return { dps, acoesPorSeg };
}

export interface ResultadoEspecie {
  pokeId: number;
  nome: string;
  peso: number;
  hpSelvagem: number;
  dps: number;
  acoesPorAbate: number;
  tLutaS: number;
  tAbateS: number;
  danoRecebidoPorSeg: number;
}

export interface ResultadoSimulacao {
  abatesH: number;
  tAbateMedioS: number;
  acoesPorAbateMedio: number;
  segundosParaDesmaiar: number | null;
  porEspecie: ResultadoEspecie[];
}

interface GolpeEfetivo {
  tipo: string;
  categoria: 'PHYSICAL' | 'SPECIAL';
  poder: number;
  recargaMs: number;
  stabSempre?: boolean;
}

const ivDe = (ivs: Ivs | number, k: keyof Stats) => (typeof ivs === 'number' ? ivs : ivs[k]);

function golpesDoAtacante(a: Atacante): GolpeEfetivo[] {
  const speedBase = a.especie.bases?.speed ?? 0;
  const ivSpeed = ivDe(a.ivs, 'speed');
  const daEspecie = a.especie.golpes
    .filter((g: Golpe) => g.nivelAprende <= a.nivel)
    .map((g) => ({
      tipo: g.tipo,
      categoria: g.categoria,
      poder: g.poder,
      recargaMs: cooldownComSpeed(g.cooldownMs, speedBase, ivSpeed),
    }));
  const z = a.tmElemental
    ? [
        {
          tipo: a.tmElemental.toUpperCase(),
          categoria: a.tmFisico ? ('PHYSICAL' as const) : ('SPECIAL' as const),
          poder: PODER_Z,
          recargaMs: RECARGA_Z_MS,
        },
      ]
    : [];
  return [...daEspecie, ...z];
}

function multSazonal(
  p: ParametrosCombate,
  atacante: readonly string[],
  defensor: readonly string[],
  atacanteSelvagem: boolean,
): number {
  const tipo = p.tipoSazonal;
  if (!tipo) return 1;
  const selvagemProtegido = p.escudoSazonal;
  const ataca =
    atacante.includes(tipo) && !(atacanteSelvagem && selvagemProtegido) ? MULT_SAZONAL : 1;
  const apanha =
    defensor.includes(tipo) && !(!atacanteSelvagem && selvagemProtegido) ? MULT_SAZONAL ** 2 : 1;
  return ataca / apanha;
}

function tipoDaInvestida(
  tipos: readonly string[],
  defensor: readonly string[],
  tabela: TabelaTipos,
) {
  const [t1, t2] = tipos;
  if (t1 && efetividade(t1, defensor, tabela) === 0 && t2) return t2;
  return t1 ?? 'NORMAL';
}

function danoDosGolpes(
  golpes: readonly GolpeEfetivo[],
  investida: GolpeEfetivo,
  nivel: number,
  atacanteStats: Stats,
  atacanteTipos: readonly string[],
  defensorStats: Stats,
  defensorTipos: readonly string[],
  tabela: TabelaTipos,
  p: ParametrosCombate,
  multDano: number,
): GolpeAlocavel[] {
  return [...golpes, investida].map((g) => {
    const fisico = g.categoria === 'PHYSICAL';
    const ef = efetividadeNaHunt(efetividade(g.tipo, defensorTipos, tabela), p.ampliacaoHunt);
    return {
      dano:
        danoMedio({
          nivel,
          poder: g.poder,
          atk: fisico ? atacanteStats.atk : atacanteStats.spAtk,
          def: fisico ? defensorStats.def : defensorStats.spDef,
          stab: g.stabSempre === true || atacanteTipos.includes(g.tipo),
          ef,
        }) * multDano,
      recargaMs: g.recargaMs,
    };
  });
}

export function simularHunt(
  a: Atacante,
  hunt: Hunt,
  catalogo: CatalogoEspecies,
  tabela: TabelaTipos,
  p: ParametrosCombate,
): ResultadoSimulacao | null {
  if (!a.especie.bases) return null;
  const meus = a.statsProntos ?? statsNoNivel(a.especie.bases, a.ivs, a.nivel, a.qualidade, a.mult);
  const meuHp = a.hpCombate ?? hpDeCombate(meus.hp);
  const ivSpeed = ivDe(a.ivs, 'speed');
  const intervalo = intervaloGlobalMs(ivSpeed);
  const golpes = golpesDoAtacante(a);
  const totalPontos = hunt.especies.reduce((s, e) => s + Math.max(0, e.pontos), 0) || 1;
  const porOnda = Math.min(MAX_MOBS, totalPontos);
  const alvosAoe = a.tmAoe ? Math.max(1, porOnda / 2) : 1;

  const porEspecie: ResultadoEspecie[] = [];
  for (const { pokeId, pontos } of hunt.especies) {
    const esp = catalogo.obter(pokeId);
    if (!esp?.bases) continue;
    const st = statsNoNivel(esp.bases, IV_MEDIO, hunt.nivel, QUALIDADE_MEDIA_SELVAGEM, 1);
    const hp = hpDeCombate(st.hp) * p.multHpSelvagem;
    const investida: GolpeEfetivo = {
      tipo: tipoDaInvestida(a.especie.tipos, esp.tipos, tabela),
      categoria: 'PHYSICAL',
      poder: PODER_INVESTIDA,
      recargaMs: recargaInvestidaMs(ivSpeed),
      stabSempre: true,
    };
    const meusGolpes = danoDosGolpes(
      golpes,
      investida,
      a.nivel,
      meus,
      a.especie.tipos,
      st,
      esp.tipos,
      tabela,
      p,
      p.multDanoExtra * multSazonal(p, a.especie.tipos, esp.tipos, false),
    );
    const { dps, acoesPorSeg } = alocarDps(meusGolpes, intervalo);
    if (dps <= 0) continue;
    const danoPorAcao = dps / acoesPorSeg;
    const acoesPorAbate = Math.max(1, Math.ceil(hp / danoPorAcao));
    const tLutaS = acoesPorAbate / acoesPorSeg / alvosAoe;
    const tAbateS = tLutaS + p.deslocamentoPorAbateS + p.esperaPorOndaS / porOnda;

    const investidaSelvagem: GolpeEfetivo = {
      tipo: tipoDaInvestida(esp.tipos, a.especie.tipos, tabela),
      categoria: 'PHYSICAL',
      poder: PODER_INVESTIDA,
      recargaMs: 2000,
      stabSempre: true,
    };
    const golpesSelvagem = esp.golpes.map((g) => ({
      tipo: g.tipo,
      categoria: g.categoria,
      poder: g.poder,
      recargaMs: g.cooldownMs,
    }));
    const recebidos = danoDosGolpes(
      golpesSelvagem,
      investidaSelvagem,
      hunt.nivel,
      st,
      esp.tipos,
      meus,
      a.especie.tipos,
      tabela,
      p,
      p.multDanoSelvagem * multSazonal(p, esp.tipos, a.especie.tipos, true),
    );
    porEspecie.push({
      pokeId,
      nome: esp.nome,
      peso: Math.max(0, pontos) / totalPontos,
      hpSelvagem: hp,
      dps,
      acoesPorAbate,
      tLutaS,
      tAbateS,
      danoRecebidoPorSeg: alocarDps(recebidos, INTERVALO_SELVAGEM_MS).dps,
    });
  }
  if (porEspecie.length === 0) return null;
  const pesoTotal = porEspecie.reduce((s, e) => s + e.peso, 0) || 1;
  const media = (f: (e: ResultadoEspecie) => number) =>
    porEspecie.reduce((s, e) => s + e.peso * f(e), 0) / pesoTotal;
  const tAbateMedioS = media((e) => e.tAbateS);
  const recebidoMedio = media((e) => e.danoRecebidoPorSeg);
  return {
    abatesH: 3600 / tAbateMedioS,
    tAbateMedioS,
    acoesPorAbateMedio: media((e) => e.acoesPorAbate),
    segundosParaDesmaiar: recebidoMedio > 0 ? meuHp / recebidoMedio : null,
    porEspecie,
  };
}
