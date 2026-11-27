import { atacanteDe } from '../analysis/atacante';
import { calibrar, calibrarComponentes, type Calibracao } from '../analysis/calibracao';
import { ouroPorAbate, xpDoNivel } from '../analysis/formulasJogo';
import type { Multiplicadores } from '../analysis/multiplicadores';
import { simularHunt, type ResultadoSimulacao } from '../analysis/simulador';
import type { CatalogoEspecies } from '../domain/catalogo';
import type { ParametrosCombate } from '../domain/parametros';
import type { EstadoJogo, Jogador } from '../domain/estadoJogo';
import type { Hunt, PokemonJogador } from '../domain/schemas';
import type { Sessao } from '../domain/sessao';

export interface AnaliseDoPokemon {
  pokemon: PokemonJogador;
  abatesH: number;
  xpPokemonH: number;
  xpTreinadorH: number;
  goldH: number;
  tAbateS: number;
  acoesPorAbate: number;
  segundosParaDesmaiar: number | null;
}

export interface AnaliseDeHunt extends AnaliseDoPokemon {
  slug: string;
  nome: string;
  nivel: number;
}

const DIA_MS = 86_400_000;

function nivelMedio(inicial: number | undefined, final: number | undefined): number | undefined {
  if (inicial === undefined) return final;
  return final === undefined ? inicial : Math.round((inicial + final) / 2);
}

export type Simulador = (hunt: Hunt) => ResultadoSimulacao | null;

export class ServicoSimulacao {
  constructor(
    private readonly estado: EstadoJogo,
    private readonly especies: CatalogoEspecies,
  ) {}

  simuladorPara(pk: PokemonJogador, ajustes?: Partial<ParametrosCombate>): Simulador | null {
    const atacante = atacanteDe(pk, this.especies);
    if (!atacante) return null;
    const parametros = { ...this.estado.parametrosCombate, ...ajustes };
    return (hunt) =>
      simularHunt(atacante, hunt, this.especies, this.estado.tabelaTipos, parametros);
  }

  calibracao(sessoes: readonly Sessao[]): Calibracao | null {
    const casos = this.casosDeCalibracao(sessoes);
    const amostrasComponentes = casos.flatMap(({ sessao, pokemon, hunt, dia }) => {
      const sim = this.simuladorPara(pokemon, dia)?.(hunt);
      if (!sim) return [];
      return [
        {
          abatesReais: sessao.abates,
          msAtivo: sessao.msAtivo,
          golpesReais: sessao.golpesDados ?? 0,
          golpesSimulados: sim.acoesPorAbateMedio * sessao.abates,
          deslocamentoMs: sessao.fases?.deslocamentoMs ?? 0,
          esperaMs: sessao.fases?.esperaMs ?? 0,
          ondas: sessao.fases?.ondas ?? 0,
        },
      ];
    });
    const componentes = calibrarComponentes(amostrasComponentes);
    const ajustes: Partial<ParametrosCombate> = {
      ...(componentes?.fatorDano ? { multDanoExtra: componentes.fatorDano } : {}),
      ...(componentes?.deslocamentoPorAbateS !== null &&
      componentes?.deslocamentoPorAbateS !== undefined
        ? { deslocamentoPorAbateS: componentes.deslocamentoPorAbateS }
        : {}),
      ...(componentes?.esperaPorOndaS !== null && componentes?.esperaPorOndaS !== undefined
        ? { esperaPorOndaS: componentes.esperaPorOndaS }
        : {}),
    };
    const residual = calibrar(
      casos.flatMap(({ sessao, pokemon, hunt, dia }) => {
        const sim = this.simuladorPara(pokemon, { ...ajustes, ...dia })?.(hunt);
        return sim
          ? [{ abatesReais: sessao.abates, msAtivo: sessao.msAtivo, abatesHSimulado: sim.abatesH }]
          : [];
      }),
    );
    return residual ? { ...residual, componentes, ajustes } : null;
  }

  private casosDeCalibracao(sessoes: readonly Sessao[]) {
    const pokemons = this.estado.jogador()?.pokemons ?? [];
    return sessoes.flatMap((sessao) => {
      const hunt = this.estado.huntPorSlug(sessao.huntSlug);
      const registro = sessao.pokemon;
      const dia = this.diaDaSessao(sessao);
      if (!registro || !hunt || !dia) return [];
      const atual = pokemons.find((p) => String(p.id) === registro.id);
      const nivel = nivelMedio(registro.level, registro.levelFinal);
      const mesmoNivel = atual?.level === nivel;
      const pokemon: PokemonJogador = {
        ...(atual ?? { id: registro.id }),
        ...(registro.speciesId !== undefined ? { speciesId: registro.speciesId } : {}),
        ...(nivel !== undefined ? { level: nivel } : {}),
        ...(mesmoNivel ? {} : { stats: undefined, maxHp: undefined }),
      };
      return [{ sessao, pokemon, hunt, dia }];
    });
  }

  private diaDaSessao(sessao: Sessao): Partial<ParametrosCombate> | null {
    if (sessao.sazonal)
      return { tipoSazonal: sessao.sazonal.tipo, escudoSazonal: sessao.sazonal.escudo };
    const fim = this.estado.fimDiaSazonal;
    const deHoje = fim !== null && sessao.inicio >= fim - DIA_MS && sessao.inicio < fim;
    return deHoje ? {} : null;
  }

  melhoresHunts(
    pokemon: PokemonJogador,
    hunts: readonly Hunt[],
    criterio: 'xp' | 'gold',
    limite: number,
    calibracao: Calibracao | null,
    mult: Multiplicadores,
  ): AnaliseDeHunt[] {
    const simular = this.simuladorPara(pokemon, calibracao?.ajustes);
    if (!simular) return [];
    return hunts
      .flatMap((hunt) => {
        const sim = simular(hunt);
        if (!sim) return [];
        const analise = analisar(pokemon, hunt, sim, calibracao, mult);
        return [{ ...analise, slug: hunt.slug, nome: hunt.nome || hunt.slug, nivel: hunt.nivel }];
      })
      .toSorted((a, b) => (criterio === 'xp' ? b.xpPokemonH - a.xpPokemonH : b.goldH - a.goldH))
      .slice(0, limite);
  }

  equipe(j: Jogador): PokemonJogador[] {
    const temSlots = j.pokemons.some((p) => p.slot !== undefined);
    if (!temSlots) return j.pokemons;
    return j.pokemons.filter(
      (p) => (p.slot !== undefined && p.slot !== null) || String(p.id) === j.activeId,
    );
  }

  analisarTime(
    hunt: Hunt,
    time: readonly PokemonJogador[],
    calibracao: Calibracao | null,
    mult: Multiplicadores,
  ): AnaliseDoPokemon[] {
    return time
      .flatMap((pokemon) => {
        const sim = this.simuladorPara(pokemon, calibracao?.ajustes)?.(hunt);
        return sim ? [analisar(pokemon, hunt, sim, calibracao, mult)] : [];
      })
      .toSorted((a, b) => b.xpPokemonH - a.xpPokemonH);
  }
}

function analisar(
  pokemon: PokemonJogador,
  hunt: Hunt,
  sim: ResultadoSimulacao,
  calibracao: Calibracao | null,
  mult: Multiplicadores,
): AnaliseDoPokemon {
  const ajuste = calibracao?.fator ?? 1;
  const abatesH = sim.abatesH * ajuste;
  const xp = xpDoNivel(hunt.nivel);
  return {
    pokemon,
    abatesH,
    xpPokemonH: abatesH * xp * mult.xpPokemon,
    xpTreinadorH: abatesH * xp * mult.xpTreinador,
    goldH: abatesH * ouroPorAbate(hunt.nivel, mult.bonusLootPct),
    tAbateS: sim.tAbateMedioS / ajuste,
    acoesPorAbate: sim.acoesPorAbateMedio,
    segundosParaDesmaiar: sim.segundosParaDesmaiar,
  };
}
