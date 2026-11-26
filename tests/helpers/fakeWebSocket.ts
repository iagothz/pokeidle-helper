import { vi } from 'vitest';

export class FakeWebSocket extends EventTarget {
  static instancias: FakeWebSocket[] = [];
  readonly send = vi.fn();
  readonly close = vi.fn();
  readonly url: string;
  private handler: ((ev: MessageEvent) => void) | null = null;

  constructor(url: string | URL, _protocolos?: string | string[]) {
    super();
    this.url = String(url);
    FakeWebSocket.instancias.push(this);
  }

  set onmessage(fn: ((ev: MessageEvent) => void) | null) {
    if (this.handler) this.removeEventListener('message', this.handler as EventListener);
    this.handler = fn;
    if (fn) this.addEventListener('message', fn as EventListener);
  }

  get onmessage() {
    return this.handler;
  }

  receber(dados: string | ArrayBuffer) {
    this.dispatchEvent(new MessageEvent('message', { data: dados }));
  }
}

export function criarJanelaFalsa(host = 'pokeidle.io') {
  FakeWebSocket.instancias = [];
  return {
    WebSocket: FakeWebSocket as unknown as typeof WebSocket,
    location: { href: `https://${host}/app`, host },
    setTimeout: (fn: () => void) => fn(),
  };
}

export function agendadorManual() {
  const pendentes: (() => void)[] = [];
  return {
    agendar: (fn: () => void) => void pendentes.push(fn),
    executar() {
      while (pendentes.length) pendentes.shift()!();
    },
    get pendentes() {
      return pendentes.length;
    },
  };
}
