import { describe, expect, it, vi } from 'vitest';
import { EstadoJogo } from '../../src/domain/estadoJogo';
import welcome from '../fixtures/welcome.json';
import { logDeTeste } from '../helpers/log';

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

  it('acha o pokémon ativo e o nível no formato real do jogo (estado = jogador)', () => {
    const { log } = logDeTeste();
    const estado = new EstadoJogo(log);
    estado.aplicarMensagem({
      t: 'welcome',
      estado: {
        cheio: true,
        nick: 'a',
        activeId: 77,
        pokemons: [
          { id: 76, speciesId: 1, level: 10 },
          { id: 77, speciesId: 4, level: 200 },
        ],
      },
    });
    expect(estado.pokemonAtivo()).toMatchObject({ id: 77, level: 200 });
    estado.aplicarMensagem({
      t: 'estado',
      estado: { pkMud: [{ id: 77, speciesId: 4, level: 201 }] },
    });
    expect(estado.pokemonAtivo()?.level).toBe(201);
    expect(estado.jogador()?.pokemons).toHaveLength(2);
    estado.aplicarMensagem({ t: 'estado', estado: { pkFora: [76] } });
    expect(estado.jogador()?.pokemons.map((p) => p.id)).toEqual([77]);
  });

  it('lê dados de combate dos pokémons e parâmetros de combate e captura do welcome', () => {
    const { log } = logDeTeste();
    const estado = new EstadoJogo(log);
    expect(estado.parametrosCombate).toMatchObject({
      ampliacaoHunt: 1.5,
      multHpSelvagem: 5,
      multDanoSelvagem: 1.8,
      multDanoExtra: 1,
    });
    estado.aplicarMensagem({
      t: 'welcome',
      ampliacaoHunt: 2,
      multHpSelvagem: '4',
      multDanoSelvagem: 'x',
      chanceShiny: 0.001,
      captura: { base: 0.01, piso: 0.002, teto: 0.2, raridadeDiv: 20 },
      catalogoBolas: [{ id: 3, name: 'Ultra', priceGold: 800, catchRate: 3 }],
      estado: {
        nick: 'a',
        activeId: 1,
        pokemons: [
          {
            id: 1,
            speciesId: 4,
            level: 30,
            ivs: { hp: 10, atk: 20, def: 'x', spAtk: 32, spDef: 1, speed: 15 },
            quality: 1.3,
            potencia: 2,
            shiny: true,
            refino: { atk: 5 },
            stats: { hp: 90, atk: 80, def: 70, spAtk: 60, spDef: 50, speed: 40 },
            maxHp: 1080,
            tmElemental: 'water',
            tmFisico: true,
            tmAoe: 1,
          },
        ],
      },
    });
    expect(estado.parametrosCombate).toMatchObject({
      ampliacaoHunt: 2,
      multHpSelvagem: 4,
      multDanoSelvagem: 1.8,
    });
    expect(estado.chanceShiny).toBe(0.001);
    expect(estado.captura).toEqual({ base: 0.01, piso: 0.002, teto: 0.2, raridadeDiv: 20 });
    expect(estado.bolas.get(3)?.catchRate).toBe(3);
    expect(estado.pokemonAtivo()).toMatchObject({
      ivs: { hp: 10, atk: 20, spAtk: 32, spDef: 1, speed: 15 },
      quality: 1.3,
      potencia: 2,
      refino: { atk: 5 },
      stats: { atk: 80 },
      maxHp: 1080,
      tmElemental: 'WATER',
      tmFisico: true,
      tmAoe: true,
    });
  });

  it('inclui o dia sazonal e o Shield do Novato nos parâmetros de combate', () => {
    const { log } = logDeTeste();
    const estado = new EstadoJogo(log);
    estado.aplicarMensagem({
      t: 'welcome',
      estado: {
        nick: 'a',
        level: 209,
        diaSazonal: { tipo: 'FIRE', fim: 123 },
        loja: { alvoAtrasados: 1296 },
      },
    });
    expect(estado.parametrosCombate).toMatchObject({ tipoSazonal: 'FIRE', escudoSazonal: true });
    estado.aplicarMensagem({ t: 'estado', estado: { level: 1300, diaSazonal: { tipo: 'XYZ' } } });
    expect(estado.parametrosCombate).toMatchObject({ tipoSazonal: null, escudoSazonal: false });
  });

  it('aplica deltas de estado e notifica ouvintes', () => {
    const { log } = logDeTeste();
    const estado = new EstadoJogo(log);
    estado.aplicarMensagem(welcome);
    const ouvinte = vi.fn();
    estado.inscrever(ouvinte);
    estado.aplicarMensagem({
      t: 'estado',
      estado: { gold: 5000, huntSlug: 'geodude', activeId: 2 },
    });
    expect(ouvinte).toHaveBeenCalledTimes(1);
    expect(estado.jogador()).toMatchObject({ gold: 5000, huntSlug: 'geodude', nick: 'Iagoths' });
    expect(estado.pokemonAtivo()?.speciesId).toBe(7);
    expect(estado.jogador()?.pokemons).toHaveLength(2);
  });

  it('lê o inventário de itens e bolas e acompanha os deltas', () => {
    const { log } = logDeTeste();
    const estado = new EstadoJogo(log);
    estado.aplicarMensagem({
      t: 'welcome',
      estado: { nick: 'a', items: { '11': 30, '12': '4', x: 'lixo' }, balls: { '1': 9 } },
    });
    expect(estado.jogador()).toMatchObject({ itens: { '11': 30, '12': 4 }, bolas: { '1': 9 } });
    estado.aplicarMensagem({ t: 'estado', estado: { items: { '11': 29, '12': 4 } } });
    expect(estado.jogador()?.itens).toEqual({ '11': 29, '12': 4 });
    estado.aplicarMensagem({ t: 'estado', estado: { items: 'quebrado' } });
    expect(estado.jogador()?.itens).toEqual({});
  });

  it('expõe os bônus do jogador, os tipos de boost e o evento de farm vigente', () => {
    const { log } = logDeTeste();
    const estado = new EstadoJogo(log);
    estado.aplicarMensagem({
      t: 'welcome',
      tiposBoost: [{ chave: 'xp', mult: 2 }, { chave: 'ruim' }, 'lixo'],
      estado: {
        nick: 'a',
        loja: { vipAte: 500, boosts: { xp: 400, loot: 'x' } },
        guildBonusPct: '12',
        guild: { boostAte: 300 },
        evento: { farmPct: 20, terminaEm: 1000 },
      },
    });
    expect(estado.bonus(100)).toEqual({
      tiposBoost: [{ chave: 'xp', mult: 2 }],
      loja: { vipAte: 500, boosts: { xp: 400 } },
      guildBonusPct: 12,
      guildBoostAte: 300,
      farmEventoPct: 20,
    });
    expect(estado.bonus(2000).farmEventoPct).toBe(0);
    const vazio = new EstadoJogo(log);
    expect(vazio.bonus(0)).toEqual({ tiposBoost: [], loja: { boosts: {} }, farmEventoPct: 0 });
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

  it('descarta pokémons inválidos e isola falhas de ouvintes', () => {
    const { log, memoria } = logDeTeste();
    const estado = new EstadoJogo(log);
    estado.inscrever(() => {
      throw new Error('ouvinte quebrado');
    });
    estado.aplicarMensagem({
      t: 'welcome',
      estado: { nick: 'raiz', pokemons: [{ id: 'a' }, 'lixo'] },
    });
    expect(estado.jogador()).toMatchObject({ nick: 'raiz', huntSlug: null });
    expect(estado.jogador()?.pokemons).toHaveLength(1);
    expect(estado.pokemonAtivo()?.id).toBe('a');
    expect(memoria.entradas.some((e) => e.nivel === 'ERROR')).toBe(true);
  });
});
