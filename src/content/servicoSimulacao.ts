import { atacanteDe } from '../analysis/atacante';
import { calibrar, type Calibracao } from '../analysis/calibracao';
import { ouroPorAbate, xpDoNivel } from '../analysis/formulasJogo';
import type { Multiplicadores } from '../analysis/multiplicadores';
import { simularHunt, type ResultadoSimulacao } from '../analysis/simulador';
import type { CatalogoEspecies } from '../domain/catalogo';
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

export type Simulador = (hunt: Hunt) => ResultadoSimulacao | null;

export class ServicoSimulacao {
  constructor(
    private readonly estado: EstadoJogo,
    private readonly especies: CatalogoEspecies,
  ) {}

  simuladorPara(pk: PokemonJogador): Simulador | null {
    const atacante = atacanteDe(pk, this.especies);
    if (!atacante) return null;
    return (hunt) =>
      simularHunt(
        atacante,
        hunt,
        this.especies,
        this.estado.tabelaTipos,
        this.estado.parametrosCombate,
      );
  }

  calibracao(sessoes: readonly Sessao[]): Calibracao | null {
    const pokemons = this.estado.jogador()?.pokemons ?? [];
    const amostras = sessoes.flatMap((s) => {
      const hunt = this.estado.huntPorSlug(s.huntSlug);
      const registro = s.pokemon;
      if (!registro || !hunt) return [];
      const atual = pokemons.find((p) => String(p.id) === registro.id);
      const mesmoNivel = atual?.level === registro.level;
      const pk: PokemonJogador = {
        ...(atual ?? { id: registro.id }),
        ...(registro.speciesId !== undefined ? { speciesId: registro.speciesId } : {}),
        ...(registro.level !== undefined ? { level: registro.level } : {}),
        ...(mesmoNivel ? {} : { stats: undefined, maxHp: undefined }),
      };
      const sim = this.simuladorPara(pk)?.(hunt);
      return sim
        ? [{ abatesReais: s.abates, msAtivo: s.msAtivo, abatesHSimulado: sim.abatesH }]
        : [];
    });
    return calibrar(amostras);
  }

  melhoresHunts(
    pokemon: PokemonJogador,
    hunts: readonly Hunt[],
    criterio: 'xp' | 'gold',
    limite: number,
    calibracao: Calibracao | null,
    mult: Multiplicadores,
  ): AnaliseDeHunt[] {
    const simular = this.simuladorPara(pokemon);
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
        const sim = this.simuladorPara(pokemon)?.(hunt);
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
