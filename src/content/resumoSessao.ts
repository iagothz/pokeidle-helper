import type { Calibracao } from '../analysis/calibracao';
import { ajustarCurvaNivel, resumirCurva } from '../analysis/curvaNivel';
import type { Multiplicadores } from '../analysis/multiplicadores';
import type { ResultadoSimulacao } from '../analysis/simulador';
import type { Taxas } from '../analysis/taxas';
import type { Especie } from '../domain/catalogo';
import type { ParametrosCombate } from '../domain/parametros';
import type { PokemonJogador } from '../domain/schemas';
import type { Sessao } from '../domain/sessao';

const arred = (v: number, casas = 2) => Math.round(v * 10 ** casas) / 10 ** casas;
const porAbate = (total: number, abates: number) => (abates > 0 ? arred(total / abates) : null);

export interface EntradaResumo {
  sessao: Sessao;
  huntNivel: number | null;
  especie: Especie | undefined;
  taxas: Taxas;
  simulado: ResultadoSimulacao | null;
  calibracao: Calibracao | null;
  parametros: ParametrosCombate;
  multiplicadores: Multiplicadores;
}

export function montarResumoSessao(e: EntradaResumo): Record<string, unknown> {
  const s = e.sessao;
  const f = s.fases;
  const t = e.taxas;
  return {
    hunt: s.huntSlug,
    huntNivel: e.huntNivel,
    pokemon: s.pokemon ? { ...s.pokemon, ...(e.especie ? { nome: e.especie.nome } : {}) } : null,
    minutosAtivos: arred(s.msAtivo / 60_000, 1),
    abates: s.abates,
    abatesH: Math.round(t.abatesH),
    xpPokemonH: Math.round(t.xpPokemonH),
    xpTreinadorH: Math.round(t.xpTreinadorH),
    goldH: Math.round(t.goldH),
    lucroLiquidoH: Math.round(t.lucroLiquidoH),
    lucroRealH: Math.round(t.lucroRealH),
    golpesPorAbate: porAbate(s.golpesDados, s.abates),
    danoMedioCausado: s.golpesDados > 0 ? Math.round(s.danoCausado / s.golpesDados) : null,
    golpesRecebidos: s.golpesRecebidos,
    danoMedioRecebido:
      s.golpesRecebidos > 0 ? Math.round(s.danoRecebido / s.golpesRecebidos) : null,
    fases: {
      lutaS: arred(f.lutaMs / 1000, 1),
      deslocamentoS: arred(f.deslocamentoMs / 1000, 1),
      esperaS: arred(f.esperaMs / 1000, 1),
      ondas: f.ondas,
      lutaPorAbateS: porAbate(f.lutaMs / 1000, s.abates),
      deslocamentoPorAbateS: porAbate(f.deslocamentoMs / 1000, s.abates),
      esperaPorOndaS: f.ondas > 0 ? arred(f.esperaMs / 1000 / f.ondas) : null,
    },
    porNivel: (s.trechos ?? []).map((tr) => ({
      level: tr.level ?? null,
      minutos: arred(tr.msAtivo / 60_000, 1),
      abates: tr.abates,
      golpesPorAbate: porAbate(tr.golpesDados, tr.abates),
      lutaPorAbateS: porAbate(tr.fases.lutaMs / 1000, tr.abates),
      xpPokemonH: tr.msAtivo > 0 ? Math.round(tr.xpPokemon / (tr.msAtivo / 3_600_000)) : null,
    })),
    curvaNivel: resumirCurva(ajustarCurvaNivel(s.trechos ?? [])),
    abatesDetalhados: s.abatesDetalhe?.length ?? 0,
    consumosDetalhados: s.consumo?.length ?? 0,
    simulado: e.simulado
      ? {
          abatesH: Math.round(e.simulado.abatesH),
          golpesPorAbate: arred(e.simulado.acoesPorAbateMedio),
          tAbateS: arred(e.simulado.tAbateMedioS),
        }
      : null,
    calibracao: e.calibracao
      ? {
          fator: arred(e.calibracao.fator, 3),
          sessoes: e.calibracao.sessoes,
          fatorDano: e.calibracao.componentes?.fatorDano ?? null,
          deslocamentoPorAbateS: e.calibracao.componentes?.deslocamentoPorAbateS ?? null,
          esperaPorOndaS: e.calibracao.componentes?.esperaPorOndaS ?? null,
        }
      : null,
    tipoSazonal: e.parametros.tipoSazonal,
    escudoSazonal: e.parametros.escudoSazonal,
    bonus: e.multiplicadores.ativos,
    capturas: s.capturas,
    fugas: s.fugas,
    desmaios: s.desmaios,
  };
}

export function dadosDeCombate(pk: PokemonJogador, especie: Especie | undefined) {
  return {
    id: String(pk.id),
    speciesId: pk.speciesId ?? null,
    level: pk.level ?? null,
    ivs: !!pk.ivs,
    quality: pk.quality ?? null,
    potencia: pk.potencia ?? null,
    shiny: pk.shiny ?? false,
    refino: pk.refino ?? null,
    stats: !!pk.stats,
    maxHp: pk.maxHp ?? null,
    tmElemental: pk.tmElemental ?? null,
    tmAoe: pk.tmAoe ?? false,
    golpes: especie?.golpes.length ?? 0,
  };
}
