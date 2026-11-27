import { describe, expect, it } from 'vitest';
import { Aplicacao } from '../../src/content/aplicacao';
import { EstadoJogo } from '../../src/domain/estadoJogo';
import { VERSAO_SESSAO, novaSessao, type Sessao } from '../../src/domain/sessao';
import { CONFIG_PADRAO } from '../../src/shared/config';
import { catalogos } from '../helpers/catalogos';
import { logDeTeste } from '../helpers/log';
import welcome from '../fixtures/welcome.json';

function criarApp(salvas: Sessao[] = []) {
  const { log } = logDeTeste();
  const { especies, itens } = catalogos();
  return new Aplicacao({
    config: CONFIG_PADRAO,
    log,
    estado: new EstadoJogo(log),
    repositorio: {
      salvar: async () => undefined,
      listar: async () => salvas,
      limpar: async () => undefined,
    },
    especies,
    itens,
    versao: 'teste',
  });
}

describe('Aplicacao com simulação de combate', () => {
  const env = (dados: unknown, recebidoEm: number) => ({
    origem: 'pokeidle-helper' as const,
    v: 1 as const,
    tipo: 'mensagem' as const,
    recebidoEm,
    dados,
  });

  it('simula hunts não visitadas, analisa o time e registra o pokémon da sessão', () => {
    const app = criarApp();
    app.receber(env(welcome, 0));
    app.receber(env({ t: 'estado', estado: { huntSlug: 'geodude' } }, 1000));
    const m = app.modelo();
    expect(m.ranking?.linhas.find((l) => l.slug === 'oddish')?.fonte).toBe('simulado');
    expect(m.time?.huntNome).toBe('Geodude');
    expect(m.time?.linhas.map((l) => l.pokemon.nome)).toEqual(['Squirtle', 'Charmander']);
    expect(m.sessao?.sugestao?.nome).toBe('Squirtle');
    expect(app.rastreador.sessaoAtual?.pokemon).toEqual({ id: '1', speciesId: 4, level: 5 });
  });

  it('entrega à sessão as outras hunts liberadas e o histórico da hunt atual', async () => {
    const antiga: Sessao = {
      ...novaSessao('bellsprout', 'Bellsprout', 0),
      id: 'antiga',
      msAtivo: 3_600_000,
      abates: 100,
      xpPokemon: 800,
      gold: 4100,
      aberta: false,
    };
    const app = criarApp([antiga]);
    await app.carregarHistorico();
    app.receber(env({ ...welcome, estado: { ...welcome.estado, level: 5 } }, 0));
    app.receber(env({ t: 'batalha', ev: [{ k: 'hunt', slug: 'bellsprout' }] }, 1000));
    const ref = app.modelo().sessao!.referencia;
    expect(ref.outras.xp).toHaveLength(1);
    expect(ref.historico).toMatchObject({ xp: 800, abates: 100, gold: 4100 });
  });

  it('lista as melhores hunts simuladas para um pokémon do time', () => {
    const app = criarApp();
    app.receber(env(welcome, 0));
    const r = app.melhoresHuntsPara('2', 'xp', 2);
    expect(r).toHaveLength(2);
    expect(r[0]!.xpPokemonH).toBeGreaterThanOrEqual(r[1]!.xpPokemonH);
    expect(r[0]).toMatchObject({ slug: expect.any(String), abatesH: expect.any(Number) });
    expect(app.melhoresHuntsPara('999', 'xp', 5)).toEqual([]);
    const lucro = app.melhoresHuntsPara('2', 'gold', 3);
    expect(lucro[0]!.goldH).toBeGreaterThanOrEqual(lucro[1]!.goldH);
  });
});

describe('Aplicacao: logs para diagnóstico', () => {
  const env = (dados: unknown, recebidoEm: number) => ({
    origem: 'pokeidle-helper' as const,
    v: 1 as const,
    tipo: 'mensagem' as const,
    recebidoEm,
    dados,
  });

  it('registra os dados de combate do ativo uma vez e o resumo completo ao fechar a sessão', () => {
    const { log, memoria } = logDeTeste();
    const { especies, itens } = catalogos();
    const app = new Aplicacao({
      config: { ...CONFIG_PADRAO, sessaoMinimaMs: 0 },
      log,
      estado: new EstadoJogo(log),
      repositorio: {
        salvar: async () => undefined,
        listar: async () => [],
        limpar: async () => undefined,
      },
      especies,
      itens,
      versao: 'teste',
    });
    app.receber(env(welcome, 0));
    app.receber(env({ t: 'batalha', ev: [{ k: 'spawn', speciesId: 69 }] }, 1_000));
    app.receber(env({ t: 'batalha', ev: [{ k: 'ataque', por: 'jogador', dano: 50 }] }, 2_000));
    app.receber(
      env(
        { t: 'batalha', ev: [{ k: 'morte', quem: 'selvagem', xp: 8, ouro: 41, drops: [] }] },
        3_000,
      ),
    );
    app.receber(env({ t: 'estado', estado: { gold: 1 } }, 3_500));
    app.receber(env({ t: 'estado', estado: { huntSlug: 'geodude' } }, 4_000));

    const ativos = memoria.entradas.filter((e) => e.msg === 'Dados de combate do ativo');
    expect(ativos).toHaveLength(1);
    expect(ativos[0]!.ctx).toMatchObject({
      id: '1',
      speciesId: 4,
      level: 5,
      ivs: false,
      stats: false,
      golpes: 2,
    });

    const resumo = memoria.entradas.find((e) => e.msg === 'Resumo da sessão');
    expect(resumo?.ctx).toMatchObject({
      hunt: 'bellsprout',
      huntNivel: 1,
      pokemon: { id: '1', speciesId: 4, nome: 'Charmander', level: 5 },
      abates: 1,
      golpesPorAbate: 1,
      danoMedioCausado: 50,
      fases: { lutaS: 1, deslocamentoS: 1, esperaS: 1, ondas: 1 },
      simulado: { abatesH: expect.any(Number), golpesPorAbate: expect.any(Number) },
      tipoSazonal: null,
    });
    expect(resumo?.ctx).toHaveProperty('xpPokemonH');
    expect(resumo?.ctx).toHaveProperty('lucroRealH');
    expect(resumo?.ctx).toHaveProperty('calibracao');
  });
});

describe('Aplicacao.carregarHistorico', () => {
  it('normaliza sessões salvas por versões anteriores', async () => {
    const antiga = {
      ...novaSessao('bellsprout', 'Bellsprout', 0),
      schemaVersion: 1,
    } as Partial<Sessao>;
    delete antiga.tokens;
    delete antiga.golpesRecebidos;
    const app = criarApp([antiga as Sessao]);
    await app.carregarHistorico();
    const [s] = app.exportarDados().sessoes;
    expect(s).toMatchObject({ schemaVersion: VERSAO_SESSAO, tokens: {}, golpesRecebidos: 0 });
  });
});
