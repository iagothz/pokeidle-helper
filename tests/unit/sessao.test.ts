import { describe, expect, it } from 'vitest';
import {
  RastreadorSessao,
  VERSAO_SESSAO,
  normalizarSessao,
  novaSessao,
  type Sessao,
} from '../../src/domain/sessao';
import batalhas from '../fixtures/batalha-bellsprout.json';
import { logDeTeste } from '../helpers/log';

function criar(opcoes: Partial<{ sessaoMinimaMs: number; pausaMaximaMs: number }> = {}) {
  const salvas: Sessao[] = [];
  const { log, memoria } = logDeTeste();
  const r = new RastreadorSessao(
    {
      pausaMaximaMs: opcoes.pausaMaximaMs ?? 60_000,
      sessaoMinimaMs: opcoes.sessaoMinimaMs ?? 0,
      agora: () => 999_999,
      aoSalvar: (s) => salvas.push(s),
      nomeDaHunt: (slug) => (slug === 'geodude' ? 'Geodude' : undefined),
    },
    log,
  );
  return { r, salvas, memoria };
}

function reproduzir(r: RastreadorSessao) {
  for (const b of batalhas) r.processarEventos(b.ev, b.em);
}

describe('RastreadorSessao', () => {
  it('conta a sessão do mesmo jeito que o painel SESSÃO do jogo', () => {
    const { r } = criar();
    reproduzir(r);
    const s = r.sessaoAtual!;
    expect(s).toMatchObject({
      huntSlug: 'bellsprout',
      huntNome: 'Bellsprout',
      abates: 3,
      xpTreinador: 24,
      xpPokemon: 24,
      gold: 123,
      capturas: 1,
      shiniesVistos: 1,
      shinies: 0,
      bolas: { '1': 1, '2': 1 },
      pocoes: { '11': 1 },
      revives: { '12': 1 },
      spawns: { '69': 2 },
      drops: {
        '70000': { nome: 'Bronze Boss Token', qtd: 1 },
        'nome:Seed': { nome: 'Seed', qtd: 2 },
      },
    });
    expect(r.eventosInvalidos).toBe(1);
  });

  it('conta como ativo só o tempo até a pausa máxima entre eventos', () => {
    const { r } = criar({ pausaMaximaMs: 60_000 });
    reproduzir(r);
    expect(r.sessaoAtual!.msAtivo).toBe(8000 + 60_000 + 30_000);
  });

  it('ignora eventos de combate sem hunt definida', () => {
    const { r } = criar();
    r.processarEventos([{ k: 'morte', quem: 'selvagem', xp: 8, ouro: 41, drops: [] }], 10);
    expect(r.sessaoAtual).toBeNull();
  });

  it('salva ao trocar de hunt e descarta sessões curtas', () => {
    const { r, salvas, memoria } = criar({ sessaoMinimaMs: 50_000 });
    reproduzir(r);
    r.definirHunt('geodude', undefined, 240_000);
    expect(salvas).toHaveLength(1);
    expect(salvas[0]).toMatchObject({ huntSlug: 'bellsprout', aberta: false, abates: 3 });
    expect(salvas[0]!.fim).toBe(240_000);
    expect(r.sessaoAtual).toMatchObject({ huntSlug: 'geodude', huntNome: 'Geodude' });
    r.processarEventos([{ k: 'spawn', speciesId: 74 }], 241_000);
    r.definirHunt(null, undefined, 242_000);
    expect(salvas).toHaveLength(1);
    expect(memoria.entradas.some((e) => e.msg === 'Sessão curta descartada')).toBe(true);
  });

  it('faz checkpoint de sessões abertas e mantém a mesma hunt sem reiniciar', () => {
    const { r, salvas } = criar({ sessaoMinimaMs: 1000 });
    reproduzir(r);
    r.definirHunt('bellsprout');
    r.checkpoint();
    expect(salvas).toHaveLength(1);
    expect(salvas[0]).toMatchObject({ aberta: true, abates: 3 });
    expect(salvas[0]!.id).toBe(r.sessaoAtual!.id);
  });

  it('não faz checkpoint de sessão abaixo do mínimo nem sem sessão', () => {
    const { r, salvas } = criar({ sessaoMinimaMs: 10_000_000 });
    r.checkpoint();
    reproduzir(r);
    r.checkpoint();
    expect(salvas).toHaveLength(0);
  });

  it('contém falhas ao salvar', () => {
    const { log, memoria } = logDeTeste();
    const r = new RastreadorSessao(
      {
        pausaMaximaMs: 60_000,
        sessaoMinimaMs: 0,
        aoSalvar: () => {
          throw new Error('disco cheio');
        },
        nomeDaHunt: () => undefined,
      },
      log,
    );
    reproduzir(r);
    expect(() => r.encerrar('teste')).not.toThrow();
    expect(memoria.entradas.some((e) => e.nivel === 'ERROR')).toBe(true);
  });

  it('conta golpes recebidos dos selvagens sem contar como tempo ativo', () => {
    const { r } = criar();
    r.definirHunt('bellsprout', 'Bellsprout', 0);
    r.processarEventos([{ k: 'spawn', speciesId: 69 }], 1000);
    r.processarEventos(
      [
        { k: 'ataque', por: 'selvagem', slot: 3, tipo: 'GRASS', dano: 120, ef: 2 },
        { k: 'ataque', por: 'selvagem', slot: 3, tipo: 'GRASS', dano: 30, ef: 0.5 },
        { k: 'ataque', por: 'selvagem', slot: 4, tipo: 'POISON', dano: 200, ef: 4 },
        { k: 'ataque', por: 'jogador', slot: 3, tipo: 'FIRE', dano: 622, ef: 2.5 },
        { k: 'ataque', por: 'selvagem', dano: 'x', ef: 'y' },
      ],
      50_000,
    );
    const s = r.sessaoAtual!;
    expect(s.golpesRecebidos).toBe(4);
    expect(s.golpesSuperEfetivos).toBe(2);
    expect(s.danoRecebido).toBe(350);
    expect(s.msAtivo).toBe(0);
  });

  it('conta desmaios do seu pokémon, XP perdido e fugas de captura', () => {
    const { r } = criar();
    r.definirHunt('bellsprout', 'Bellsprout', 0);
    r.processarEventos(
      [
        { k: 'morte', quem: 'jogador' },
        { k: 'morte', quem: 'jogador' },
        { k: 'xpPerdido', qtd: 150 },
        { k: 'xpPerdido', qtd: -5 },
        { k: 'xpPerdido', qtd: 'x' },
        { k: 'fugiu', nome: 'Bellsprout', level: 3 },
        { k: 'capturado', pokemon: {} },
      ],
      1000,
    );
    expect(r.sessaoAtual).toMatchObject({ desmaios: 2, xpPerdido: 150, fugas: 1, capturas: 1 });
  });

  it('soma o gold das capturas vendidas automaticamente', () => {
    const { r } = criar();
    r.definirHunt('bellsprout', 'Bellsprout', 0);
    r.processarEventos(
      [
        { k: 'capturado', pokemon: {}, vendidoAuto: 1500 },
        { k: 'capturado', pokemon: {}, vendidoAuto: 'x' },
        { k: 'capturado', pokemon: {} },
      ],
      1000,
    );
    expect(r.sessaoAtual).toMatchObject({ capturas: 3, vendasAuto: 1500 });
  });

  it('registra o primeiro pokémon ativo visto na sessão', () => {
    const { r } = criar();
    r.registrarPokemon({ id: '9', speciesId: 4, level: 30 });
    expect(r.sessaoAtual).toBeNull();
    r.definirHunt('bellsprout', 'Bellsprout', 0);
    r.registrarPokemon({ id: '9', speciesId: 4, level: 30 });
    r.registrarPokemon({ id: '10', speciesId: 7, level: 50 });
    expect(r.sessaoAtual?.pokemon).toEqual({ id: '9', speciesId: 4, level: 30 });
  });

  it('registra tokens gastos ao entrar num boss, como o jogo', () => {
    const { r } = criar();
    r.definirHunt('bellsprout', 'Bellsprout', 0);
    r.processarEventos(
      [{ k: 'bossEntrou' }, { k: 'bossEntrou', entrada: { itemId: 70011, qtd: 3 } }],
      1000,
    );
    expect(r.sessaoAtual!.tokens).toEqual({ '70000': 1, '70011': 3 });
  });

  it('rejeita ids inválidos de consumíveis', () => {
    const { r } = criar();
    r.definirHunt('bellsprout', 'Bellsprout', 0);
    r.processarEventos(
      [
        { k: 'cura', itemId: 'abc' },
        { k: 'cura', itemId: -1 },
        { k: 'revive' },
        { k: 'bola', ballId: 1.5 },
      ],
      1,
    );
    expect(r.sessaoAtual).toMatchObject({ pocoes: {}, revives: {}, bolas: {} });
  });
});

describe('normalizarSessao', () => {
  it('completa sessões da versão 1 com os campos novos zerados', () => {
    const antiga = {
      ...novaSessao('bellsprout', 'Bellsprout', 0),
      schemaVersion: 1,
      golpesRecebidos: undefined,
      golpesSuperEfetivos: undefined,
      danoRecebido: undefined,
      tokens: undefined,
      desmaios: undefined,
      xpPerdido: undefined,
      fugas: undefined,
    };
    const s = normalizarSessao(antiga as unknown as Sessao);
    expect(s).toMatchObject({
      schemaVersion: VERSAO_SESSAO,
      golpesRecebidos: 0,
      golpesSuperEfetivos: 0,
      danoRecebido: 0,
      tokens: {},
      desmaios: 0,
      xpPerdido: 0,
      fugas: 0,
      huntSlug: 'bellsprout',
    });
  });

  it('mantém sessões atuais intactas', () => {
    const atual = { ...novaSessao('x', 'X', 5), golpesRecebidos: 7, tokens: { '70000': 2 } };
    expect(normalizarSessao(atual)).toEqual(atual);
  });
});
