import { describe, expect, it } from 'vitest';
import {
  analisarCaptura,
  chanceDeCaptura,
  chanceFragmentoOvoShiny,
  estagiosEvolutivos,
  fatorDeCaptura,
  pedrasPorAbate,
  tetoDeCaptura,
} from '../../src/analysis/economia';
import { CatalogoEspecies } from '../../src/domain/catalogo';
import { CAPTURA_PADRAO } from '../../src/domain/parametros';
import type { Hunt } from '../../src/domain/schemas';

function catalogo() {
  const c = new CatalogoEspecies();
  const b = { baseHp: 50, baseAtk: 50, baseDef: 50, baseSpAtk: 50, baseSpDef: 50, baseSpeed: 50 };
  c.adicionarJson([
    {
      pokeId: 1,
      name: 'Basico',
      type1: 'GRASS',
      type2: 'POISON',
      ...b,
      evolvesToId: 2,
      priceNpc: 100,
    },
    {
      pokeId: 2,
      name: 'Medio',
      type1: 'GRASS',
      type2: 'POISON',
      ...b,
      evolvesToId: 3,
      priceNpc: 1000,
    },
    { pokeId: 3, name: 'Final', type1: 'GRASS', ...b, evolvesToId: 0, priceNpc: 10000 },
    {
      pokeId: 10,
      name: 'Solo',
      type1: 'GHOST',
      type2: 'DARK',
      ...b,
      evolvesToId: 0,
      priceNpc: 50000,
    },
    { pokeId: 20, name: 'Par1', type1: 'WATER', ...b, evolvesToId: 21, priceNpc: 0 },
    { pokeId: 21, name: 'Par2', type1: 'WATER', ...b, evolvesToId: 0, priceNpc: 0 },
  ]);
  return c;
}

describe('estágios e teto de captura (teto-captura.mjs)', () => {
  it('estágio e tamanho da cadeia pela evolução', () => {
    const e = estagiosEvolutivos(catalogo());
    expect(e.get(1)).toEqual({ estagio: 0, elos: 3 });
    expect(e.get(2)).toEqual({ estagio: 1, elos: 3 });
    expect(e.get(3)).toEqual({ estagio: 2, elos: 3 });
    expect(e.get(10)).toEqual({ estagio: 0, elos: 1 });
    expect(e.get(21)).toEqual({ estagio: 1, elos: 2 });
  });

  it('teto pela escada da cadeia', () => {
    const e = estagiosEvolutivos(catalogo());
    expect([1, 2, 3, 10, 20, 21, 99].map((id) => tetoDeCaptura(id, e))).toEqual([
      20, 40, 100, 100, 40, 100, 100,
    ]);
  });
});

describe('chance de captura (app.js chanceDeCaptura)', () => {
  it('fator pelo degrau da hunt ou pela raridade do preço', () => {
    expect(fatorDeCaptura(20, true, 100, 17)).toBe(2.8669);
    expect(fatorDeCaptura(70, true, 100, 17)).toBe(4.4681);
    expect(fatorDeCaptura(20, false, 1000, 17)).toBeCloseTo(1 + 8 / 17, 10);
    expect(fatorDeCaptura(20, false, 10, 17)).toBeCloseTo(1 + 1 / 17, 10);
  });

  it('chance limitada entre piso e teto, com corpo caído (×1,4)', () => {
    expect(chanceDeCaptura(1, 2.8669, CAPTURA_PADRAO)).toBeCloseTo(0.0075 * (1 / 2.8669) * 1.4, 10);
    expect(chanceDeCaptura(0.01, 2.8669, CAPTURA_PADRAO)).toBe(0.003);
    expect(chanceDeCaptura(200, 2.8669, CAPTURA_PADRAO)).toBe(0.1);
    expect(chanceDeCaptura(255, 2.8669, CAPTURA_PADRAO)).toBe(1);
  });

  it('analisa cada espécie da hunt por bola e aponta a mais barata por captura', () => {
    const c = catalogo();
    const hunt: Hunt = {
      slug: 'h',
      nome: 'H',
      nivel: 10,
      especies: [
        { pokeId: 1, pontos: 3 },
        { pokeId: 2, pontos: 1 },
      ],
    };
    const bolas = [
      { id: 1, name: 'Poke', priceGold: 50, catchRate: 1 },
      { id: 2, name: 'Great', priceGold: 300, catchRate: 2 },
      { id: 3, name: 'Master', priceGold: 99999, catchRate: 255 },
    ];
    const r = analisarCaptura(hunt, c, bolas, CAPTURA_PADRAO, [hunt]);
    expect(r).toHaveLength(2);
    const basico = r[0]!;
    expect(basico.nome).toBe('Basico');
    expect(basico.peso).toBeCloseTo(0.75, 10);
    const poke = basico.porBola.find((b) => b.bolaId === 1)!;
    expect(poke.chance).toBeCloseTo(0.0075 * (1 / 2.8669) * 1.4, 10);
    expect(poke.bolasPorCaptura).toBeCloseTo(1 / poke.chance, 10);
    expect(poke.custoPorCaptura).toBeCloseTo(50 / poke.chance, 6);
    expect(basico.melhorBolaId).toBe(1);
    expect(basico.porBola.find((b) => b.bolaId === 3)!.chance).toBe(1);
  });
});

describe('drops por abate', () => {
  it('pedras por estágio e tipo (loot-pedras.mjs), Ghost e Dark contam uma pedra só', () => {
    const c = catalogo();
    const hunt: Hunt = {
      slug: 'h',
      nome: 'H',
      nivel: 10,
      especies: [
        { pokeId: 1, pontos: 1 },
        { pokeId: 10, pontos: 1 },
      ],
    };
    const r = pedrasPorAbate(hunt, c);
    expect(r.get('Leaf Stone')).toBeCloseTo(0.5 * 0.002, 10);
    expect(r.get('Venom Stone')).toBeCloseTo(0.5 * 0.002, 10);
    expect(r.get('Darkness Stone')).toBeCloseTo(0.5 * 0.005, 10);
  });

  it('fragmento de ovo shiny por degrau a partir do nível 5000, nunca no Outland', () => {
    expect(chanceFragmentoOvoShiny({ nivel: 4999 })).toBe(0);
    expect(chanceFragmentoOvoShiny({ nivel: 5000 })).toBeCloseTo(1 / 150_000, 15);
    expect(chanceFragmentoOvoShiny({ nivel: 5400 })).toBeCloseTo((1 / 150_000) * 1.04, 15);
    expect(chanceFragmentoOvoShiny({ nivel: 200_000 })).toBeCloseTo(
      (1 / 150_000) * (1 + 0.04 * 31),
      15,
    );
    expect(chanceFragmentoOvoShiny({ nivel: 6000, area: 'outland' })).toBe(0);
  });
});
