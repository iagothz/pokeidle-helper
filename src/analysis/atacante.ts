import type { CatalogoEspecies } from '../domain/catalogo';
import type { PokemonJogador } from '../domain/schemas';
import { IV_MEDIO, multDeNascenca, type Stats } from './combate';
import type { Atacante } from './simulador';

const CHAVES: readonly (keyof Stats)[] = ['hp', 'atk', 'def', 'spAtk', 'spDef', 'speed'];

function statsCompletos(s: Partial<Stats> | undefined): Stats | undefined {
  if (!s || !CHAVES.every((k) => typeof s[k] === 'number')) return undefined;
  return s as Stats;
}

export function atacanteDe(pk: PokemonJogador, catalogo: CatalogoEspecies): Atacante | null {
  const especie = catalogo.obter(pk.speciesId);
  if (!especie?.bases) return null;
  const r = pk.refino ?? {};
  const b = especie.bases;
  const bases = {
    hp: b.hp + (r.hp ?? 0),
    atk: b.atk + (r.atk ?? 0),
    def: b.def + (r.def ?? 0),
    spAtk: b.spAtk + (r.spAtk ?? 0),
    spDef: b.spDef + (r.spDef ?? 0),
    speed: b.speed,
  };
  return {
    especie: { ...especie, bases },
    nivel: pk.level ?? 1,
    ivs: pk.ivs ?? IV_MEDIO,
    qualidade: pk.quality ?? 1,
    mult: multDeNascenca(pk.potencia, pk.shiny),
    statsProntos: statsCompletos(pk.stats),
    hpCombate: pk.maxHp,
    tmElemental: pk.tmElemental,
    tmFisico: pk.tmFisico,
    tmAoe: pk.tmAoe,
  };
}
