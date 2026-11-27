import type { CatalogoEspecies } from '../domain/catalogo';
import type { Hunt, PokemonJogador, TabelaTipos } from '../domain/schemas';
import { melhorEfetividade } from './tipos';

export type Classificacao = 'vantagem' | 'neutro' | 'desvantagem' | 'desconhecido';

export interface AvaliacaoTipo {
  ofensiva: number | null;
  defensiva: number | null;
  classificacao: Classificacao;
  perigo: boolean;
  especiesConhecidas: number;
  especiesTotal: number;
}

export interface TiposPokemon {
  ataque: string[];
  defesa: string[];
}

export function tiposDoPokemon(
  pk: PokemonJogador | undefined,
  catalogo: CatalogoEspecies,
): TiposPokemon | null {
  if (!pk) return null;
  const especie = catalogo.obter(pk.speciesId);
  const defesa = (pk.tipos?.length ? pk.tipos : (especie?.tipos ?? [])).map((t) => t.toUpperCase());
  const ataque = especie?.tiposAtaque.length ? especie.tiposAtaque : defesa;
  if (ataque.length === 0 && defesa.length === 0) return null;
  return { ataque, defesa };
}

export function classificar(ofensiva: number | null): Classificacao {
  if (ofensiva === null) return 'desconhecido';
  if (ofensiva >= 1.5) return 'vantagem';
  if (ofensiva < 1) return 'desvantagem';
  return 'neutro';
}

export function avaliarHunt(
  hunt: Hunt,
  tipos: TiposPokemon | null,
  catalogo: CatalogoEspecies,
  tabela: TabelaTipos,
): AvaliacaoTipo {
  let pesoTotal = 0;
  let ofensiva = 0;
  let defensiva = 0;
  let conhecidas = 0;
  for (const { pokeId, pontos } of hunt.especies) {
    const esp = catalogo.obter(pokeId);
    if (!esp || esp.tipos.length === 0 || !tipos) continue;
    const peso = Math.max(0, pontos) || 1;
    conhecidas++;
    pesoTotal += peso;
    ofensiva += melhorEfetividade(tipos.ataque, esp.tipos, tabela) * peso;
    defensiva += melhorEfetividade(esp.tiposAtaque, tipos.defesa, tabela) * peso;
  }
  const of = pesoTotal > 0 ? ofensiva / pesoTotal : null;
  const df = pesoTotal > 0 ? defensiva / pesoTotal : null;
  return {
    ofensiva: of,
    defensiva: df,
    classificacao: classificar(of),
    perigo: df !== null && df >= 2,
    especiesConhecidas: conhecidas,
    especiesTotal: hunt.especies.length,
  };
}

export interface SugestaoTime {
  pokemon: PokemonJogador;
  avaliacao: AvaliacaoTipo;
  pontuacao: number;
}

const DEFENSIVA_MINIMA = 0.25;
const FATOR_NIVEL_MINIMO = 0.01;

export function pontuarParaHunt(
  avaliacao: Pick<AvaliacaoTipo, 'ofensiva' | 'defensiva'>,
  nivel: number | undefined,
  hunt: Pick<Hunt, 'nivel'>,
): number | null {
  if (avaliacao.ofensiva === null) return null;
  const defensiva = Math.max(avaliacao.defensiva ?? 1, DEFENSIVA_MINIMA);
  const fatorNivel =
    nivel === undefined || hunt.nivel <= 0 || nivel >= hunt.nivel
      ? 1
      : Math.sqrt(Math.max(nivel / hunt.nivel, FATOR_NIVEL_MINIMO));
  return (avaliacao.ofensiva / Math.sqrt(defensiva)) * fatorNivel;
}

export function melhorDoTime(
  hunt: Hunt,
  time: readonly PokemonJogador[],
  catalogo: CatalogoEspecies,
  tabela: TabelaTipos,
): SugestaoTime | null {
  let melhor: SugestaoTime | null = null;
  for (const pokemon of time) {
    const avaliacao = avaliarHunt(hunt, tiposDoPokemon(pokemon, catalogo), catalogo, tabela);
    const pontuacao = pontuarParaHunt(avaliacao, pokemon.level, hunt);
    if (pontuacao === null) continue;
    if (!melhor || pontuacao > melhor.pontuacao) melhor = { pokemon, avaliacao, pontuacao };
  }
  return melhor;
}
