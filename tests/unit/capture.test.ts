import { describe, expect, it, vi } from 'vitest';
import { instalarCaptura, LIMITE_FILA } from '../../src/capture/hook';
import type { EnvelopePonte } from '../../src/shared/protocolo';
import type { FakeWebSocket } from '../helpers/fakeWebSocket';
import { agendadorManual, criarJanelaFalsa } from '../helpers/fakeWebSocket';

function preparar() {
  const janela = criarJanelaFalsa();
  const agenda = agendadorManual();
  const publicados: EnvelopePonte[] = [];
  const captura = instalarCaptura(janela, {
    publicar: (e) => publicados.push(e),
    agendar: agenda.agendar,
    agora: () => 1000,
  });
  const ws = new janela.WebSocket('wss://pokeidle.io') as unknown as FakeWebSocket;
  return { janela, agenda, publicados, captura, ws };
}

describe('captura do WebSocket', () => {
  it('publica welcome, estado e batalha e ignora o resto', () => {
    const { agenda, publicados, ws } = preparar();
    ws.receber('{"t":"welcome","hunts":[]}');
    ws.receber('{"t":"estado","estado":{"servidorAgora":1}}');
    ws.receber('{"t":"batalha","ev":[{"k":"spawn"}]}');
    ws.receber('{"t":"campo","mobs":[]}');
    ws.receber('{"t":"chat","texto":"oi"}');
    ws.receber('{"t":"desconhecido"}');
    ws.receber('não é json');
    ws.receber('[1,2]');
    ws.receber(new ArrayBuffer(4));
    agenda.executar();
    expect(publicados.map((p) => (p.dados as { t: string }).t)).toEqual([
      'welcome',
      'estado',
      'batalha',
    ]);
    expect(publicados[0]).toMatchObject({
      origem: 'pokeidle-helper',
      v: 1,
      tipo: 'mensagem',
      recebidoEm: 1000,
    });
  });

  it('entrega a mensagem intacta ao handler do jogo e só processa depois', () => {
    const { agenda, publicados, ws } = preparar();
    const recebidoPeloJogo: string[] = [];
    ws.onmessage = (ev) => recebidoPeloJogo.push(ev.data as string);
    const bruto = '{"t":"batalha","ev":[{"k":"morte","xp":8}]}';
    ws.receber(bruto);
    expect(recebidoPeloJogo).toEqual([bruto]);
    expect(publicados).toHaveLength(0);
    expect(agenda.pendentes).toBe(1);
    agenda.executar();
    expect(publicados).toHaveLength(1);
  });

  it('remove dados sensíveis antes de publicar', () => {
    const { agenda, publicados, ws } = preparar();
    ws.receber(
      JSON.stringify({
        t: 'welcome',
        token: 'abc',
        estado: { eu: { nick: 'x', email: 'a@b.c', carteira: 'sol', gold: 5 } },
      }),
    );
    agenda.executar();
    expect(publicados[0]!.dados).toEqual({ t: 'welcome', estado: { eu: { nick: 'x', gold: 5 } } });
    expect(JSON.stringify(publicados)).not.toMatch(/abc|a@b\.c|sol"/);
  });

  it('não observa sockets de outros hosts', () => {
    const { janela, agenda, publicados } = preparar();
    const outro = new janela.WebSocket('wss://outro.exemplo.com') as unknown as FakeWebSocket;
    outro.receber('{"t":"welcome"}');
    agenda.executar();
    expect(publicados).toHaveLength(0);
  });

  it('é idempotente e pode ser desinstalado', () => {
    const janela = criarJanelaFalsa();
    const original = janela.WebSocket;
    const a = instalarCaptura(janela, { publicar: vi.fn() });
    const b = instalarCaptura(janela, { publicar: vi.fn() });
    expect(a).toBe(b);
    expect(janela.WebSocket).not.toBe(original);
    expect(janela.WebSocket.name).toBe('WebSocket');
    a.desinstalar();
    expect(janela.WebSocket).toBe(original);
  });

  it('limita a fila e conta descartes sem lançar', () => {
    const { agenda, ws, captura } = preparar();
    for (let i = 0; i < LIMITE_FILA + 10; i++) ws.receber('{"t":"estado","estado":{}}');
    expect(captura.estatisticas().descartadas).toBe(10);
    agenda.executar();
    expect(captura.estatisticas().publicadas).toBe(LIMITE_FILA);
  });

  it('contém erros do publicador sem afetar o jogo', () => {
    const janela = criarJanelaFalsa();
    const agenda = agendadorManual();
    const captura = instalarCaptura(janela, {
      publicar: () => {
        throw new Error('falhou');
      },
      agendar: agenda.agendar,
    });
    const ws = new janela.WebSocket('wss://pokeidle.io') as unknown as FakeWebSocket;
    const jogo = vi.fn();
    ws.onmessage = jogo;
    expect(() => ws.receber('{"t":"welcome"}')).not.toThrow();
    expect(() => agenda.executar()).not.toThrow();
    expect(jogo).toHaveBeenCalledTimes(1);
    expect(captura.estatisticas().erros).toBe(1);
  });
});

describe('RNF01 · somente leitura', () => {
  it('nunca envia mensagens, nunca faz fetch e nunca altera o DOM', () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.reject(new Error('proibido')));
    const mutacoes: MutationRecord[] = [];
    const observador = new MutationObserver((m) => mutacoes.push(...m));
    observador.observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });

    const { agenda, ws } = preparar();
    ws.onmessage = () => undefined;
    const mensagens = [
      '{"t":"welcome","hunts":[{"slug":"a"}]}',
      '{"t":"estado","estado":{"eu":{"gold":1}}}',
      '{"t":"batalha","ev":[{"k":"morte","quem":"selvagem","xp":8,"ouro":41}]}',
      '{"t":"campo","mobs":[]}',
    ];
    for (let i = 0; i < 50; i++) for (const m of mensagens) ws.receber(m);
    agenda.executar();

    observador.takeRecords().forEach((m) => mutacoes.push(m));
    observador.disconnect();
    expect(ws.send).not.toHaveBeenCalled();
    expect(ws.close).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mutacoes).toHaveLength(0);
    fetchSpy.mockRestore();
  });
});

describe('RNF03 · desempenho', () => {
  it('processa uma mensagem de batalha típica em menos de 1 ms (p95)', () => {
    const { agenda, ws } = preparar();
    const bruto = JSON.stringify({
      t: 'batalha',
      ev: [
        {
          k: 'ataque',
          por: 'jogador',
          slot: 12,
          golpe: 'Overheat',
          tipo: 'FIRE',
          dano: 622,
          ef: 2.5,
          stab: true,
          hpAlvo: 0,
          aoe: false,
        },
        {
          k: 'morte',
          quem: 'selvagem',
          slot: 12,
          nome: 'Bellsprout',
          xp: 8,
          xpTreinador: 8,
          xpPokemon: 8,
          ouro: 41,
          ouroLoot: 5,
          drops: [],
        },
      ],
    });
    const tempos: number[] = [];
    for (let i = 0; i < 500; i++) {
      const t0 = performance.now();
      ws.receber(bruto);
      agenda.executar();
      tempos.push(performance.now() - t0);
    }
    tempos.sort((a, b) => a - b);
    expect(tempos[Math.floor(tempos.length * 0.95)]!).toBeLessThan(1);
  });
});
