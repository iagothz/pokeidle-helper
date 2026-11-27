import { describe, expect, it } from 'vitest';
import { CatalogoEspecies } from '../../src/domain/catalogo';
import { catalogos } from '../helpers/catalogos';

describe('CatalogoEspecies com dados de combate', () => {
  it('guarda stats base, golpes completos, evolução e preço', () => {
    const { especies } = catalogos();
    expect(especies.obter(69)).toMatchObject({
      nome: 'Bellsprout',
      bases: { hp: 50, atk: 75, def: 35, spAtk: 70, spDef: 30, speed: 40 },
      evolvesToId: 70,
      evolveLevel: 30,
      priceNpc: 80,
    });
    expect(especies.obter(69)?.golpes[0]).toEqual({
      nome: 'Vine Whip',
      tipo: 'GRASS',
      categoria: 'PHYSICAL',
      poder: 45,
      cooldownMs: 10000,
      nivelAprende: 1,
    });
  });

  it('aceita espécie sem stats nem golpes completos com valores neutros', () => {
    const c = new CatalogoEspecies();
    c.adicionarJson([{ pokeId: 1, name: 'X', type1: 'normal', attacks: [{ type: 'normal' }] }]);
    expect(c.obter(1)).toMatchObject({
      bases: null,
      golpes: [],
      evolvesToId: 0,
      priceNpc: 0,
    });
  });

  it('aplica os overrides de auditoria de stats e golpes', () => {
    const { especies } = catalogos();
    const n = especies.aplicarOverridesJson({
      overrides: [
        {
          pokeId: 74,
          baseAtk: 99,
          attacks: [
            {
              name: 'Rollout',
              type: 'ROCK',
              category: 'PHYSICAL',
              power: 30,
              cooldownMs: 11700,
              learnLevel: 1,
            },
          ],
        },
        { pokeId: 9999, baseAtk: 1 },
        'lixo',
      ],
    });
    expect(n).toBe(1);
    expect(especies.obter(74)?.bases?.atk).toBe(99);
    expect(especies.obter(74)?.bases?.def).toBe(100);
    expect(especies.obter(74)?.golpes.map((g) => g.nome)).toEqual(['Rollout']);
    expect(especies.aplicarOverridesJson('lixo')).toBe(0);
  });

  it('dá dois golpes 600 às formas finais, como o jogo, exceto tabelas fechadas', () => {
    const c = new CatalogoEspecies();
    const bases = {
      baseHp: 70,
      baseAtk: 100,
      baseDef: 70,
      baseSpAtk: 80,
      baseSpDef: 70,
      baseSpeed: 70,
    };
    c.adicionarJson([
      {
        pokeId: 6,
        name: 'Final',
        type1: 'FIRE',
        type2: 'FLYING',
        ...bases,
        evolvesToId: 0,
        attacks: [{ name: 'Ember', type: 'FIRE', category: 'SPECIAL', power: 40 }],
      },
      {
        pokeId: 9,
        name: 'UmTipo',
        type1: 'WATER',
        ...bases,
        baseSpAtk: 120,
        evolvesToId: 0,
        attacks: [{ name: 'Hydro', type: 'WATER', category: 'SPECIAL', power: 600 }],
      },
      { pokeId: 4, name: 'Basico', type1: 'FIRE', ...bases, evolvesToId: 5, attacks: [] },
      { pokeId: 10, name: 'Fechado', type1: 'BUG', ...bases, evolvesToId: 0, attacks: [] },
    ]);
    c.completarGolpesEspeciais(new Set([10]));
    const finais = c.obter(6)!.golpes.filter((g) => g.poder >= 600);
    expect(finais.map((g) => g.tipo).sort()).toEqual(['FIRE', 'FLYING']);
    expect(finais.every((g) => g.categoria === 'PHYSICAL' && g.cooldownMs === 60000)).toBe(true);
    const agua = c.obter(9)!.golpes.filter((g) => g.poder >= 600);
    expect(agua).toHaveLength(2);
    expect(agua.every((g) => g.tipo === 'WATER' && g.categoria === 'SPECIAL')).toBe(true);
    expect(c.obter(4)!.golpes).toHaveLength(0);
    expect(c.obter(10)!.golpes).toHaveLength(0);
  });

  it('substitui golpes por espécie e lista todas as espécies', () => {
    const { especies } = catalogos();
    especies.substituirGolpes(
      new Map([
        [
          69,
          [
            {
              nome: 'Novo',
              tipo: 'GRASS',
              categoria: 'SPECIAL',
              poder: 100,
              cooldownMs: 30000,
              nivelAprende: 1,
            },
          ],
        ],
      ]),
    );
    expect(especies.obter(69)?.golpes.map((g) => g.nome)).toEqual(['Novo']);
    expect(especies.obter(69)?.tiposAtaque).toEqual(['GRASS']);
    expect([...especies.todas()].length).toBe(5);
  });
});
