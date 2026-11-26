import { describe, expect, it, vi } from 'vitest';
import { EstadoJogo, mesclarProfundo } from '../../src/domain/estadoJogo';
import welcome from '../fixtures/welcome.json';
import { logDeTeste } from '../helpers/log';

describe('mesclarProfundo', () => {
  it('mescla objetos e substitui arrays e primitivos', () => {
    const base = { eu: { gold: 1, pokemons: [{ id: 1 }], loja: { a: 1 } }, x: 1 };
    const r = mesclarProfundo(base, {
      eu: { gold: 9, pokemons: [{ id: 2 }], loja: { b: 2 } },
      x: null,
    });
    expect(r).toEqual({ eu: { gold: 9, pokemons: [{ id: 2 }], loja: { a: 1, b: 2 } }, x: null });
    expect(base.eu.gold).toBe(1);
  });
});

describe('EstadoJogo', () => {
  it('lê o welcome: hunts válidas, tabela de tipos, bolas e jogador', () => {
    const { log, memoria } = logDeTeste();
    const estado = new EstadoJogo(log);
    expect(estado.aplicarMensagem(welcome)).toBe('welcome');
    expect(estado.recebeuWelcome).toBe(true);
    expect(estado.hunts.map((h) => h.slug)).toEqual(['bellsprout', 'oddish', 'geodude']);
    expect(estado.huntPorSlug('geodude')?.especies).toEqual([{ pokeId: 74, pontos: 4 }]);
    expect(estado.tabelaTipos.FIRE?.GRASS).toBe(2);
    expect(estado.bolas.get(2)?.priceGold).toBe(300);
    expect(estado.itensJogo.get(90001)?.npcPrice).toBe(10);
    expect(estado.jogador()).toMatchObject({
      nick: 'Iagoths',
      level: 4,
      activeId: '1',
      huntSlug: 'bellsprout',
      noCentro: false,
    });
    expect(estado.pokemonAtivo()?.speciesId).toBe(4);
    expect(
      memoria.entradas.some((e) => e.nivel === 'WARN' && e.msg.includes('Hunts ignoradas')),
    ).toBe(true);
  });

  it('aplica deltas de estado e notifica ouvintes', () => {
    const { log } = logDeTeste();
    const estado = new EstadoJogo(log);
    estado.aplicarMensagem(welcome);
    const ouvinte = vi.fn();
    estado.inscrever(ouvinte);
    estado.aplicarMensagem({
      t: 'estado',
      estado: { eu: { gold: 5000, huntSlug: 'geodude', activeId: 2 } },
    });
    expect(ouvinte).toHaveBeenCalledTimes(1);
    expect(estado.jogador()).toMatchObject({ gold: 5000, huntSlug: 'geodude', nick: 'Iagoths' });
    expect(estado.pokemonAtivo()?.speciesId).toBe(7);
    expect(estado.jogador()?.pokemons).toHaveLength(2);
  });

  it('ignora mensagens fora do formato sem lançar', () => {
    const { log, memoria } = logDeTeste();
    const estado = new EstadoJogo(log);
    expect(estado.aplicarMensagem({ t: 'estado', estado: 'x' })).toBe('ignorada');
    expect(estado.aplicarMensagem({ t: 'welcome', hunts: 'x', tabelaTipos: 5 })).toBe('welcome');
    expect(estado.aplicarMensagem({ t: 'batalha', ev: 'x' })).toBe('ignorada');
    expect(estado.aplicarMensagem({ t: 'batalha', ev: [] })).toBe('batalha');
    expect(estado.aplicarMensagem(null)).toBe('ignorada');
    expect(estado.jogador()).toBeNull();
    expect(estado.pokemonAtivo()).toBeUndefined();
    expect(memoria.entradas.filter((e) => e.nivel === 'WARN')).toHaveLength(1);
  });

  it('aceita o jogador no nível raiz do welcome e isola falhas de ouvintes', () => {
    const { log, memoria } = logDeTeste();
    const estado = new EstadoJogo(log);
    estado.inscrever(() => {
      throw new Error('ouvinte quebrado');
    });
    estado.aplicarMensagem({ t: 'welcome', eu: { nick: 'raiz', pokemons: [{ id: 'a' }, 'lixo'] } });
    expect(estado.jogador()).toMatchObject({ nick: 'raiz', huntSlug: null });
    expect(estado.jogador()?.pokemons).toHaveLength(1);
    expect(estado.pokemonAtivo()?.id).toBe('a');
    expect(memoria.entradas.some((e) => e.nivel === 'ERROR')).toBe(true);
  });
});
