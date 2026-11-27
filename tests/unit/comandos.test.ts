import { describe, expect, it, vi } from 'vitest';
import { instalarComandos } from '../../src/capture/comandos';
import { instalarCaptura } from '../../src/capture/hook';
import {
  LimitadorComandos,
  ORIGEM_COMANDO,
  VERSAO_COMANDO,
  esquemaComando,
  type ResultadoComando,
} from '../../src/shared/comandos';
import { criarJanelaFalsa, type FakeWebSocket } from '../helpers/fakeWebSocket';

const ORIGEM = 'https://pokeidle.io';

function preparar(readyState = 1) {
  const alvo = new EventTarget();
  const janela = {
    addEventListener: (t: 'message', fn: (ev: MessageEvent) => void) =>
      alvo.addEventListener(t, fn as EventListener),
    removeEventListener: (t: 'message', fn: (ev: MessageEvent) => void) =>
      alvo.removeEventListener(t, fn as EventListener),
  };
  const socket = { readyState, send: vi.fn() };
  const respostas: ResultadoComando[] = [];
  let agora = 0;
  const parar = instalarComandos({
    janela,
    origem: ORIGEM,
    socket: () => socket,
    responder: (r) => respostas.push(r),
    agora: () => agora,
  });
  let id = 0;
  const postar = (comando: unknown, extra: Record<string, unknown> = {}) =>
    alvo.dispatchEvent(
      Object.assign(
        new MessageEvent('message', {
          data: { origem: ORIGEM_COMANDO, v: VERSAO_COMANDO, id: ++id, comando, ...extra },
          origin: (extra.origin as string) ?? ORIGEM,
        }),
        {},
      ),
    );
  const postarDaJanela = (comando: unknown, origin = ORIGEM) => {
    const ev = new MessageEvent('message', {
      data: { origem: ORIGEM_COMANDO, v: VERSAO_COMANDO, id: ++id, comando },
      origin,
    });
    Object.defineProperty(ev, 'source', { value: janela });
    alvo.dispatchEvent(ev);
  };
  return {
    socket,
    respostas,
    parar,
    postar,
    postarDaJanela,
    avancar: (ms: number) => {
      agora += ms;
    },
  };
}

describe('esquema de comandos', () => {
  it('aceita só os tipos da lista branca com os campos esperados', () => {
    expect(esquemaComando.safeParse({ t: 'hunt.select', slug: 'pineco-1' }).success).toBe(true);
    expect(esquemaComando.safeParse({ t: 'shop.buy', kind: 'ball', id: 3, qty: 800 }).success).toBe(
      true,
    );
    expect(esquemaComando.safeParse({ t: 'team.active', pokemonId: '42' }).success).toBe(true);
    expect(
      esquemaComando.safeParse({ t: 'auto.set', autoBallAteCapturar: true, ballIds: [1, 2] })
        .success,
    ).toBe(true);
    expect(esquemaComando.safeParse({ t: 'chat.send', texto: 'oi' }).success).toBe(false);
    expect(esquemaComando.safeParse({ t: 'hello', token: 'x' }).success).toBe(false);
    expect(esquemaComando.safeParse({ t: 'hunt.select', slug: '../x' }).success).toBe(false);
    expect(esquemaComando.safeParse({ t: 'hunt.select', slug: 'a', extra: 1 }).success).toBe(false);
    expect(esquemaComando.safeParse({ t: 'shop.buy', kind: 'ball', id: 1, qty: 0 }).success).toBe(
      false,
    );
    expect(esquemaComando.safeParse({ t: 'shop.buy', kind: 'casa', id: 1, qty: 1 }).success).toBe(
      false,
    );
  });
});

describe('limitador de comandos', () => {
  it('limita por tipo e por minuto', () => {
    const l = new LimitadorComandos({ intervaloPorTipoMs: 1000, maximoPorMinuto: 3 });
    expect(l.permitir('a', 0)).toBe(true);
    expect(l.permitir('a', 500)).toBe(false);
    expect(l.permitir('b', 500)).toBe(true);
    expect(l.permitir('a', 1000)).toBe(true);
    expect(l.permitir('c', 1500)).toBe(false);
    expect(l.permitir('c', 60_000)).toBe(true);
  });
});

describe('receptor de comandos no mundo da página', () => {
  it('envia pelo socket do jogo e responde', () => {
    const p = preparar();
    p.postarDaJanela({ t: 'hunt.select', slug: 'sunkern' });
    expect(p.socket.send).toHaveBeenCalledWith('{"t":"hunt.select","slug":"sunkern"}');
    expect(p.respostas).toEqual([{ id: 1, t: 'hunt.select', enviado: true }]);
  });

  it('recusa tipo fora da lista branca, excesso de frequência e socket fechado', () => {
    const p = preparar();
    p.postarDaJanela({ t: 'chat.send', canal: 'mundo', texto: 'oi' });
    p.postarDaJanela({ t: 'hunt.select', slug: 'a' });
    p.postarDaJanela({ t: 'hunt.select', slug: 'a' });
    expect(p.socket.send).toHaveBeenCalledTimes(1);
    expect(p.respostas.map((r) => r.motivo)).toEqual(['invalido', undefined, 'limite']);
    const fechado = preparar(3);
    fechado.postarDaJanela({ t: 'hunt.select', slug: 'a' });
    expect(fechado.socket.send).not.toHaveBeenCalled();
    expect(fechado.respostas[0]!.motivo).toBe('sem-conexao');
  });

  it('ignora mensagens de outra origem, de outra fonte ou sem a marca', () => {
    const p = preparar();
    p.postarDaJanela({ t: 'hunt.select', slug: 'a' }, 'https://outro.exemplo.com');
    p.postar({ t: 'hunt.select', slug: 'a' });
    expect(p.socket.send).not.toHaveBeenCalled();
    expect(p.respostas).toHaveLength(0);
  });

  it('para de ouvir ao desinstalar', () => {
    const p = preparar();
    p.parar();
    p.postarDaJanela({ t: 'hunt.select', slug: 'a' });
    expect(p.socket.send).not.toHaveBeenCalled();
  });
});

describe('socket do jogo exposto pela captura', () => {
  it('guarda o último socket do host do jogo e ignora os de outros hosts', () => {
    const janela = criarJanelaFalsa();
    const captura = instalarCaptura(janela, { publicar: () => undefined });
    expect(captura.socket()).toBeNull();
    const jogo = new janela.WebSocket('wss://pokeidle.io') as unknown as FakeWebSocket;
    new janela.WebSocket('wss://outro.exemplo.com');
    expect(captura.socket()).toBe(jogo);
    captura.desinstalar();
  });
});
