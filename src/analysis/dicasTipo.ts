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
    if (avaliacao.ofensiva === null) continue;
    const atual = melhor?.avaliacao;
    const ehMelhor =
      !atual ||
      avaliacao.ofensiva > (atual.ofensiva ?? 0) ||
      (avaliacao.ofensiva === atual.ofensiva &&
        (avaliacao.defensiva ?? 0) < (atual.defensiva ?? 0));
    if (ehMelhor) melhor = { pokemon, avaliacao };
  }
  return melhor;
}
