import { describe, expect, it } from 'vitest';
import { Aplicacao } from '../../src/content/aplicacao';
import { EstadoJogo } from '../../src/domain/estadoJogo';
import { VERSAO_SESSAO, novaSessao, type Sessao } from '../../src/domain/sessao';
import { CONFIG_PADRAO } from '../../src/shared/config';
import { catalogos } from '../helpers/catalogos';
import { logDeTeste } from '../helpers/log';
import welcome from '../fixtures/welcome.json';

function criarApp(salvas: Sessao[] = [], agora?: () => number) {
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
    ...(agora ? { agora } : {}),
  });
}

function sessaoComTrechos(): Sessao {
  const trechos = [1, 2, 3, 4, 5].map((lv) => ({
    inicio: lv * 1000,
    fim: lv * 1000 + 999,
    pokemonId: '1',
    level: lv,
    tipoSazonal: null,
    msAtivo: 30 * (3_000 + 1_000 * (6 - lv)),
    abates: 30,
    golpesDados: 30 * (1 + 6 - lv),
    danoCausado: 0,
    xpPokemon: 30 * 10,
    gold: 30 * 5,
    desmaios: 0,
    fases: { lutaMs: 0, deslocamentoMs: 0, esperaMs: 0, ondas: 0 },
  }));
  return {
    ...novaSessao('bellsprout', 'Bellsprout', 0),
    id: 'com-trechos',
    msAtivo: 1_000_000,
    abates: 150,
    aberta: false,
    trechos,
  };
}

function sessaoComAutocatch(): Sessao {
  const capturas = [1, 2, 3, 4].map((t) => ({ t, k: 'captura' as const, sp: 69, v: 900 }));
  return {
    ...novaSessao('bellsprout', 'Bellsprout', 0),
    id: 'autocatch',
    msAtivo: 600_000,
    abates: 200,
    aberta: false,
    bolas: { '1': 100 },
    capturas: 4,
    vendasAuto: 3_600,
    consumo: capturas,
  };
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
    app.receber(env({ ...welcome, estado: { ...welcome.estado, level: 10 } }, 0));
    const r = app.melhoresHuntsPara('2', 'xp', 2);
    expect(r).toHaveLength(2);
    expect(r[0]!.xpPokemonH).toBeGreaterThanOrEqual(r[1]!.xpPokemonH);
    expect(r[0]).toMatchObject({ slug: expect.any(String), abatesH: expect.any(Number) });
    expect(app.melhoresHuntsPara('999', 'xp', 5)).toEqual([]);
    const lucro = app.melhoresHuntsPara('2', 'gold', 3);
    expect(lucro[0]!.goldH).toBeGreaterThanOrEqual(lucro[1]!.goldH);
  });
  it('com boost ativo, a curva usa o XP base da hunt vezes o bônus e conta o vencimento', async () => {
    const HORA = 3_600_000;
    const AGORA = 1_800_000_000_000;
    const relogio = () => AGORA;
    const vence = AGORA + HORA;
    const semBoost = criarApp([sessaoComTrechos()], relogio);
    await semBoost.carregarHistorico();
    semBoost.receber(env(welcome, 0));
    const comBoost = criarApp([sessaoComTrechos()], relogio);
    await comBoost.carregarHistorico();
    comBoost.receber(
      env(
        {
          ...welcome,
          tiposBoost: [{ chave: 'pokexp', mult: 2 }],
          estado: { ...welcome.estado, loja: { boosts: { pokexp: vence } } },
        },
        0,
      ),
    );
    const sem = semBoost.modelo().progresso!;
    const com = comBoost.modelo().progresso!;
    expect(sem.curvaNivel!.curva.xpPorAbate).not.toBe(10);
    expect(com.curvaNivel!.curva.xpPorAbate / sem.curvaNivel!.curva.xpPorAbate).toBeCloseTo(2, 10);
    expect(com.curvaNivel!.bonus.xpBasePorAbate).toBe(sem.curvaNivel!.curva.xpPorAbate);
    expect(com.curvaNivel!.bonus.faixas).toHaveLength(2);
    expect(com.curvaNivel!.bonus.faixas[0]).toMatchObject({ xpPokemon: 2, xpTreinador: 1 });
    expect(com.curvaNivel!.bonus.faixas[0]!.horas).toBe(1);
    expect(com.ritmoPokemon.faixas).toEqual(com.curvaNivel!.bonus.faixas);
    expect(com.bonus.ativos).toEqual([{ rotulo: 'boost XP pokémon', mult: 2, ate: vence }]);
  });

  it('projeta a progressão por nível do ativo na hunt atual a partir dos trechos', async () => {
    const app = criarApp([sessaoComTrechos()]);
    await app.carregarHistorico();
    app.receber(env(welcome, 0));
    const c = app.modelo().progresso?.curvaNivel;
    expect(c?.huntNome).toBe('Bellsprout');
    expect(c?.curva.amostra).toMatchObject({ niveis: 5, abates: 150 });
    expect(c?.projecao.atual.level).toBe(5);
    expect(c?.projecao.limiteNivel).toBe(9);
    expect(c?.projecao.linhas.map((l) => l.level)).toEqual([6, 9]);
  });

  it('analisa o autocatch da hunt atual com as sessões salvas', async () => {
    const app = criarApp([sessaoComAutocatch()]);
    await app.carregarHistorico();
    app.receber(env(welcome, 0));
    const e = app.modelo().economia;
    const a = e?.autocatch;
    const poke = e?.chancesNaHunt.find((c) => c.bolaId === 1);
    expect(poke).toMatchObject({ arremessos: 100, capturas: 4, medida: 0.04 });
    expect(e?.fatorCaptura?.capturas).toBe(4);
    expect(a?.amostra).toMatchObject({ bolas: 100, capturas: 4, capturasVendidas: 4 });
    expect(a?.bolasPorCaptura).toBeCloseTo(1 / poke!.calibrada!, 6);
    expect(a?.fonteBolasPorCaptura).toBe('medido');
    expect(a?.bolasPorAbate).toBe(0.5);
    expect(a?.valorPorCaptura).toBe(900);
    expect(a?.gold).not.toBeNull();
    expect(a?.pendencias).toEqual(['semTempo']);
  });

  it('sem trechos suficientes não há progressão por nível', () => {
    const app = criarApp();
    app.receber(env(welcome, 0));
    expect(app.modelo().progresso?.curvaNivel).toBeNull();
  });

  it('não indica hunts acima do nível do treinador', () => {
    const app = criarApp();
    app.receber(env({ ...welcome, estado: { ...welcome.estado, level: 5 } }, 0));
    const r = app.melhoresHuntsPara('2', 'xp', 10);
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((h) => h.nivel <= 5)).toBe(true);
    expect(r.map((h) => h.slug)).not.toContain('geodude');
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
    expect(resumo?.ctx).toHaveProperty('curvaNivel', null);
  });
});

describe('Aplicacao: backup e importação', () => {
  it('importa um backup, persiste só o que mudou e monta o backup completo', async () => {
    const existente = {
      ...novaSessao('bellsprout', 'Bellsprout', 0),
      msAtivo: 900_000,
      aberta: false,
    };
    const salvas: Sessao[] = [];
    const { log } = logDeTeste();
    const { especies, itens } = catalogos();
    const app = new Aplicacao({
      config: CONFIG_PADRAO,
      log,
      estado: new EstadoJogo(log),
      repositorio: {
        salvar: async (s) => salvas.push(s),
        listar: async () => [existente],
        limpar: async () => undefined,
      },
      especies,
      itens,
      versao: '0.8.0',
      agora: () => 42,
    });
    await app.carregarHistorico();
    const r = await app.importarSessoes({
      sessoes: [
        { ...existente, msAtivo: 100 },
        { ...novaSessao('oddish', 'Oddish', 5), msAtivo: 300_000 },
        { lixo: true },
      ],
    });
    expect(r).toEqual({ formatoValido: true, novas: 1, atualizadas: 0, mantidas: 1, invalidas: 1 });
    expect(salvas.map((s) => s.huntSlug)).toEqual(['oddish']);
    const b = app.backupCompleto();
    expect(b).toMatchObject({ formato: 'pokeidle-helper-backup', versao: '0.8.0', geradoEm: 42 });
    expect(b.sessoes.map((s) => s.huntSlug).sort()).toEqual(['bellsprout', 'oddish']);
    expect(await app.importarSessoes('lixo')).toMatchObject({ formatoValido: false, novas: 0 });
  });
});

describe('Aplicacao: carimbo do dia sazonal nas sessões de hoje', () => {
  it('grava o dia de hoje nas sessões salvas de hoje sem registro, só uma vez', async () => {
    const FIM = 10 * 86_400_000;
    const deHoje = { ...novaSessao('bellsprout', 'Bellsprout', FIM - 5_000), aberta: false };
    const deOntem = { ...novaSessao('oddish', 'Oddish', FIM - 2 * 86_400_000), aberta: false };
    const salvas: Sessao[] = [];
    const { log } = logDeTeste();
    const { especies, itens } = catalogos();
    const app = new Aplicacao({
      config: CONFIG_PADRAO,
      log,
      estado: new EstadoJogo(log),
      repositorio: {
        salvar: async (s) => salvas.push(s),
        listar: async () => [deHoje, deOntem],
        limpar: async () => undefined,
      },
      especies,
      itens,
      versao: 'teste',
    });
    await app.carregarHistorico();
    const env = (dados: unknown) => ({
      origem: 'pokeidle-helper' as const,
      v: 1 as const,
      tipo: 'mensagem' as const,
      recebidoEm: 0,
      dados,
    });
    app.receber(
      env({
        t: 'welcome',
        estado: {
          nick: 'x',
          level: 209,
          diaSazonal: { tipo: 'FIRE', fim: FIM },
          loja: { alvoAtrasados: 1296 },
        },
      }),
    );
    app.receber(env({ t: 'estado', estado: { gold: 1 } }));
    await new Promise((r) => setTimeout(r, 0));
    expect(salvas.map((s) => [s.huntSlug, s.sazonal])).toEqual([
      ['bellsprout', { tipo: 'FIRE', escudo: true }],
    ]);
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
