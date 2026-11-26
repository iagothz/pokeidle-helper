import { afterEach, describe, expect, it } from 'vitest';
import { Aplicacao } from '../../src/content/aplicacao';
import { EstadoJogo } from '../../src/domain/estadoJogo';
import { abrirBanco, type Banco } from '../../src/persistence/banco';
import { RepositorioSessoes } from '../../src/persistence/repositorioSessoes';
import { CONFIG_PADRAO } from '../../src/shared/config';
import { instalarCaptura } from '../../src/capture/hook';
import { escutarPonte, type EnvelopeValido } from '../../src/bridge/receptor';
import welcome from '../fixtures/welcome.json';
import batalhas from '../fixtures/batalha-bellsprout.json';
import { catalogos } from '../helpers/catalogos';
import { logDeTeste } from '../helpers/log';
import { agendadorManual, criarJanelaFalsa, type FakeWebSocket } from '../helpers/fakeWebSocket';

const abertos: Banco[] = [];
afterEach(() => abertos.splice(0).forEach((b) => b.close()));

async function montar(nomeBanco: string) {
  const banco = await abrirBanco(nomeBanco);
  abertos.push(banco);
  const { log, memoria } = logDeTeste();
  const { especies, itens } = catalogos();
  const estado = new EstadoJogo(log);
  const repositorio = new RepositorioSessoes(banco);
  let relogio = 0;
  const app = new Aplicacao({
    config: { ...CONFIG_PADRAO, sessaoMinimaMs: 1000, amostraMinimaMs: 60_000 },
    log,
    estado,
    repositorio,
    especies,
    itens,
    versao: 'teste',
    agora: () => relogio,
  });
  await app.carregarHistorico();
  return { app, repositorio, memoria, avancar: (ms: number) => (relogio = ms) };
}

const envelope = (dados: unknown, recebidoEm: number): EnvelopeValido => ({
  origem: 'pokeidle-helper',
  v: 1,
  tipo: 'mensagem',
  recebidoEm,
  dados,
});

describe('replay ponta a ponta (captura → ponte → domínio → persistência → análise)', () => {
  it('reconstrói sessão, salva no IndexedDB e monta ranking a partir das mensagens do jogo', async () => {
    const { app, repositorio } = await montar('replay-1');
    const janela = criarJanelaFalsa();
    const agenda = agendadorManual();
    const relogio = { t: 0 };
    instalarCaptura(janela, {
      publicar: (env) =>
        window.dispatchEvent(
          new MessageEvent('message', {
            data: env,
            origin: window.location.origin,
            source: window,
          }),
        ),
      agendar: agenda.agendar,
      agora: () => relogio.t,
    });
    const recebidos: EnvelopeValido[] = [];
    const parar = escutarPonte(
      window,
      window.location.origin,
      (e) => recebidos.push(e),
      logDeTeste().log,
    );
    const ws = new janela.WebSocket('wss://pokeidle.io') as unknown as FakeWebSocket;
    ws.receber(JSON.stringify(welcome));
    for (const b of batalhas) {
      relogio.t = b.em;
      ws.receber(JSON.stringify({ t: 'batalha', ev: b.ev }));
      ws.receber('{"t":"campo","mobs":[]}');
    }
    agenda.executar();
    await new Promise((r) => setTimeout(r, 0));
    parar();
    expect(recebidos).toHaveLength(1 + batalhas.length);
    expect(JSON.stringify(recebidos)).not.toMatch(/segredo-de-teste|teste@example\.com/);

    for (const e of recebidos) app.receber(e);
    let modelo = app.modelo();
    expect(modelo.status).toBe('pronto');
    expect(modelo.sessao).toMatchObject({ huntSlug: 'bellsprout', abates: 3, capturas: 1 });
    expect(modelo.sessao!.taxas.custos).toEqual({
      bolas: 350,
      pocoes: 100,
      revives: 1000,
      total: 1450,
    });
    expect(modelo.sessao!.tipo?.classificacao).toBe('vantagem');
    expect(modelo.sessao!.sugestao).toBeNull();
    expect(modelo.sessao!.consumidos.map((c) => c.nome)).toEqual([
      'Potion',
      'Revive',
      'Poke Ball',
      'Great Ball',
    ]);

    app.receber(envelope({ t: 'estado', estado: { eu: { huntSlug: 'geodude' } } }, 240_000));
    await new Promise((r) => setTimeout(r, 10));
    const salvas = await repositorio.listar();
    expect(salvas).toHaveLength(1);
    expect(salvas[0]).toMatchObject({
      huntSlug: 'bellsprout',
      aberta: false,
      abates: 3,
      gold: 123,
    });

    modelo = app.modelo();
    expect(modelo.sessao).toMatchObject({ huntSlug: 'geodude' });
    expect(modelo.sessao!.tipo?.classificacao).toBe('desvantagem');
    expect(modelo.sessao!.sugestao?.nome).toBe('Squirtle');
    const linhas = modelo.ranking!.linhas;
    expect(linhas.find((l) => l.slug === 'bellsprout')!.fonte).toBe('real');
    expect(linhas.find((l) => l.slug === 'geodude')!.fonte).toBe('estimado');
    expect(modelo.diagnostico).toMatchObject({
      welcome: true,
      sessoesSalvas: 1,
      eventosInvalidos: 1,
    });

    app.receber({
      origem: 'pokeidle-helper',
      v: 1,
      tipo: 'diagnostico',
      recebidoEm: 1,
      dados: { recebidas: 9 },
    });
    expect(app.modelo().diagnostico.captura).toEqual({ recebidas: 9 });
  });

  it('retoma o histórico salvo ao recarregar e encerra ao ir para o Centro', async () => {
    const primeira = await montar('replay-2');
    primeira.app.receber(envelope(welcome, 0));
    for (const b of batalhas) primeira.app.receber(envelope({ t: 'batalha', ev: b.ev }, b.em));
    primeira.app.checkpoint();
    await new Promise((r) => setTimeout(r, 10));
    expect((await primeira.repositorio.listar())[0]!.aberta).toBe(true);

    const segunda = await montar('replay-2');
    segunda.app.receber(envelope(welcome, 0));
    expect(segunda.app.modelo().diagnostico.sessoesSalvas).toBe(1);
    expect(segunda.app.modelo().ranking!.linhas[0]!.fonte).toBe('real');
    segunda.app.receber(envelope({ t: 'estado', estado: { eu: { noCentro: true } } }, 300_000));
    expect(segunda.app.modelo().sessao).toBeNull();

    expect(segunda.app.exportarDados().sessoes).toHaveLength(1);
    await segunda.app.limparHistorico();
    expect(await segunda.repositorio.listar()).toEqual([]);
  });

  it('avisa sem quebrar quando a persistência falha', async () => {
    const { log, memoria } = logDeTeste();
    const { especies, itens } = catalogos();
    const app = new Aplicacao({
      config: { ...CONFIG_PADRAO, sessaoMinimaMs: 0 },
      log,
      estado: new EstadoJogo(log),
      repositorio: {
        salvar: () => Promise.reject(new Error('quota')),
        listar: () => Promise.reject(new Error('corrompido')),
        limpar: () => Promise.resolve(),
      },
      especies,
      itens,
      versao: 'teste',
    });
    let notificacoes = 0;
    app.inscrever(() => notificacoes++);
    app.inscrever(() => {
      throw new Error('ui quebrada');
    });
    await app.carregarHistorico();
    app.receber(envelope(welcome, 0));
    for (const b of batalhas) app.receber(envelope({ t: 'batalha', ev: b.ev }, b.em));
    app.receber(envelope({ t: 'estado', estado: { eu: { huntSlug: null } } }, 400_000));
    await new Promise((r) => setTimeout(r, 10));
    expect(app.modelo().avisos).toHaveLength(2);
    expect(notificacoes).toBeGreaterThan(0);
    expect(memoria.entradas.filter((e) => e.nivel === 'ERROR').length).toBeGreaterThanOrEqual(3);
  });
});
