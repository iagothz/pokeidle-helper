import { describe, expect, it } from 'vitest';
import { MescladorEstado } from '../../src/domain/mescladorEstado';

describe('MescladorEstado (porta do shared/estado-delta.mjs do jogo)', () => {
  it('sem estado anterior, o primeiro parcial vira o estado completo', () => {
    const m = new MescladorEstado();
    expect(m.atual()).toBeNull();
    expect(m.mesclar({ gold: 1, activeId: 1, pokemons: [{ id: 1, level: 5 }] })).toEqual({
      gold: 1,
      activeId: 1,
      pokemons: [{ id: 1, level: 5 }],
    });
  });

  it('aplica campos de forma rasa e pokémons por pkMud e pkFora', () => {
    const m = new MescladorEstado();
    m.mesclar({
      gold: 1,
      loja: { vipAte: 10, boosts: { xp: 5 } },
      pokemons: [
        { id: 1, level: 5 },
        { id: 2, level: 8 },
      ],
    });
    const r = m.mesclar({
      gold: 2,
      loja: { vipAte: 20 },
      pkMud: [
        { id: 2, level: 9 },
        { id: 3, level: 1 },
      ],
      pkFora: [1],
    });
    expect(r).toEqual({
      gold: 2,
      loja: { vipAte: 20 },
      pokemons: [
        { id: 2, level: 9 },
        { id: 3, level: 1 },
      ],
    });
  });

  it('cheio recomeça o estado e uma lista de pokémons substitui a anterior', () => {
    const m = new MescladorEstado();
    m.mesclar({ gold: 1, nick: 'a', pokemons: [{ id: 1 }] });
    expect(m.mesclar({ pokemons: [{ id: 9 }] })).toMatchObject({
      nick: 'a',
      pokemons: [{ id: 9 }],
    });
    expect(m.mesclar({ cheio: true, gold: 5 })).toEqual({ gold: 5, pokemons: [] });
  });

  it('mescla a pokédex por dexMud e dexFora', () => {
    const m = new MescladorEstado();
    m.mesclar({ pokedex: { '1': 1, '2': 1 } });
    expect(m.mesclar({ dexMud: { '3': 1 }, dexFora: ['1'] })?.pokedex).toEqual({ '2': 1, '3': 1 });
  });

  it('ignora entradas que não são objetos e pokémons sem id', () => {
    const m = new MescladorEstado();
    expect(m.mesclar('lixo')).toBeNull();
    m.mesclar({ pokemons: [{ id: 1 }, 'x', { sem: 'id' }], pkMud: 'quebrado', pkFora: 'x' });
    expect(m.atual()?.pokemons).toEqual([{ id: 1 }]);
    m.limpar();
    expect(m.atual()).toBeNull();
  });
});
