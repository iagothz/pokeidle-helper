import { describe, expect, it } from 'vitest';
import {
  RastreadorSessao,
  normalizarSessao,
  novaSessao,
  type Sessao,
} from '../../src/domain/sessao';
import { logDeTeste } from '../helpers/log';

function criar(sessaoMinimaMs = 0) {
  const salvas: Sessao[] = [];
  const { log, memoria } = logDeTeste();
  const r = new RastreadorSessao(
    {
      pausaMaximaMs: 60_000,
      sessaoMinimaMs,
      agora: () => 999_999,
      aoSalvar: (s) => salvas.push(s),
      nomeDaHunt: () => undefined,
    },
    log,
  );
  return { r, salvas, memoria };
}

const spawn = { k: 'spawn', speciesId: 69 };
const golpe = (dano: number) => ({ k: 'ataque', por: 'jogador', dano });
const morte = { k: 'morte', quem: 'selvagem', xp: 10, ouro: 5, drops: [] };

function abate(r: RastreadorSessao, em: number, golpes: number) {
  r.processarEventos([spawn], em);
  for (let i = 0; i < golpes; i++) r.processarEventos([golpe(100)], em + 1_000 + i * 500);
  r.processarEventos([morte], em + 1_000 + golpes * 500);
}

describe('Coleta detalhada: registro por abate', () => {
  it('grava golpes, dano, duração da luta, XP, ouro e nível de cada abate', () => {
    const { r } = criar();
    r.definirHunt('geodude', 'Geodude', 0);
    r.registrarPokemon({ id: '9', speciesId: 6, level: 207 });
    abate(r, 0, 3);
    r.registrarPokemon({ id: '9', speciesId: 6, level: 208 });
    abate(r, 10_000, 2);
    expect(r.sessaoAtual?.abatesDetalhe).toEqual([
      { t: 2_500, lv: 207, g: 3, d: 300, l: 1_500, xp: 10, o: 5 },
      { t: 12_000, lv: 208, g: 2, d: 200, l: 1_000, xp: 10, o: 5 },
    ]);
  });
});

describe('Coleta detalhada: trechos por nível', () => {
  it('fecha um trecho a cada nível novo com os totais daquele nível', () => {
    const { r, memoria } = criar();
    r.definirHunt('geodude', 'Geodude', 0);
    r.registrarSazonal({ tipo: 'FIRE', escudo: true });
    r.registrarPokemon({ id: '9', speciesId: 6, level: 207 });
    abate(r, 0, 3);
    abate(r, 5_000, 3);
    r.registrarPokemon({ id: '9', speciesId: 6, level: 208 });
    abate(r, 10_000, 2);
    const nivel = memoria.entradas.find((e) => e.msg === 'Nível do pokémon mudou');
    expect(nivel?.ctx).toMatchObject({ de: 207, para: 208, abates: 2, golpesPorAbate: 3 });
  });

  it('salva os trechos fechados e o trecho em andamento', () => {
    const { r, salvas } = criar();
    r.definirHunt('geodude', 'Geodude', 0);
    r.registrarSazonal({ tipo: 'FIRE', escudo: true });
    r.registrarPokemon({ id: '9', speciesId: 6, level: 207 });
    abate(r, 0, 3);
    abate(r, 5_000, 3);
    r.registrarPokemon({ id: '9', speciesId: 6, level: 208 });
    abate(r, 10_000, 2);
    r.checkpoint();
    const trechos = salvas.at(-1)!.trechos!;
    expect(trechos).toHaveLength(2);
    expect(trechos[0]).toMatchObject({
      inicio: 0,
      fim: 7_500,
      pokemonId: '9',
      level: 207,
      tipoSazonal: 'FIRE',
      abates: 2,
      golpesDados: 6,
      danoCausado: 600,
      xpPokemon: 20,
      gold: 10,
      desmaios: 0,
    });
    expect(trechos[0]!.fases.lutaMs).toBe(3_000);
    expect(trechos[1]).toMatchObject({ level: 208, abates: 1, golpesDados: 2, inicio: 7_500 });
    r.encerrar('teste', 20_000);
    expect(salvas.at(-1)!.trechos!.map((t) => t.level)).toEqual([207, 208]);
    expect(r.sessaoAtual).toBeNull();
  });

  it('abre trecho novo quando troca o pokémon ativo', () => {
    const { r, salvas } = criar();
    r.definirHunt('geodude', 'Geodude', 0);
    r.registrarPokemon({ id: '9', speciesId: 6, level: 207 });
    abate(r, 0, 3);
    r.registrarPokemon({ id: '10', speciesId: 7, level: 50 });
    abate(r, 5_000, 6);
    r.encerrar('teste', 20_000);
    expect(salvas.at(-1)!.trechos!.map((t) => [t.pokemonId, t.level, t.abates])).toEqual([
      ['9', 207, 1],
      ['10', 50, 1],
    ]);
    expect(salvas.at(-1)!.pokemon).toEqual({ id: '9', speciesId: 6, level: 207 });
  });
});

describe('Coleta detalhada: troca do dia sazonal', () => {
  it('encerra a sessão e abre outra na mesma hunt quando o dia sazonal muda', () => {
    const { r, salvas } = criar();
    r.definirHunt('geodude', 'Geodude', 0);
    r.registrarSazonal({ tipo: 'FIRE', escudo: true });
    r.registrarPokemon({ id: '9', speciesId: 6, level: 207 });
    abate(r, 0, 3);
    r.registrarSazonal({ tipo: 'FIRE', escudo: true });
    expect(salvas).toHaveLength(0);
    r.registrarSazonal({ tipo: 'WATER', escudo: true });
    expect(salvas).toHaveLength(1);
    expect(salvas[0]).toMatchObject({ aberta: false, abates: 1, sazonal: { tipo: 'FIRE' } });
    const nova = r.sessaoAtual!;
    expect(nova).toMatchObject({
      huntSlug: 'geodude',
      huntNome: 'Geodude',
      abates: 0,
      sazonal: { tipo: 'WATER', escudo: true },
      pokemon: { id: '9', speciesId: 6, level: 207 },
    });
    expect(nova.id).not.toBe(salvas[0]!.id);
  });
});

describe('Coleta detalhada: linha do tempo de consumo', () => {
  it('grava poções, revives, bolas, capturas e desmaios com horário', () => {
    const { r } = criar();
    r.definirHunt('geodude', 'Geodude', 0);
    r.processarEventos([{ k: 'cura', itemId: 11 }], 1_000);
    r.processarEventos([{ k: 'morte', quem: 'jogador', drops: [] }], 2_000);
    r.processarEventos([{ k: 'revive', itemId: 12 }], 3_000);
    r.processarEventos([{ k: 'bola', ballId: 2 }], 4_000);
    r.processarEventos([{ k: 'capturado', pokemon: { shiny: true } }], 5_000);
    r.processarEventos([{ k: 'cura', itemId: 'x' }], 6_000);
    expect(r.sessaoAtual?.consumo).toEqual([
      { t: 1_000, k: 'pocao', id: 11 },
      { t: 2_000, k: 'desmaio' },
      { t: 3_000, k: 'revive', id: 12 },
      { t: 4_000, k: 'bola', id: 2 },
      { t: 5_000, k: 'captura', shiny: true },
    ]);
  });
});

describe('Coleta detalhada: compatibilidade', () => {
  it('normaliza sessões antigas com as listas vazias', () => {
    const antiga = { ...novaSessao('geodude', 'Geodude', 0) } as Partial<Sessao>;
    delete antiga.trechos;
    delete antiga.abatesDetalhe;
    delete antiga.consumo;
    expect(normalizarSessao(antiga as Sessao)).toMatchObject({
      trechos: [],
      abatesDetalhe: [],
      consumo: [],
    });
  });
});
