import { removerSensiveis } from '../shared/sanitize';
import {
  ORIGEM_PONTE,
  TIPOS_CAPTURADOS,
  VERSAO_PONTE,
  type EnvelopePonte,
} from '../shared/protocolo';

export const MARCA_INSTALADO = Symbol.for('pokeidle-helper.captura');
export const LIMITE_FILA = 2000;
export const LOTE_POR_CICLO = 200;
const TIPOS = new Set<string>(TIPOS_CAPTURADOS);
const PREFIXO_IGNORADO = /^\{\s*"t"\s*:\s*"(campo|chat|pong|vivo|praca\.salas)"/;

export interface OpcoesCaptura {
  publicar: (envelope: EnvelopePonte) => void;
  agora?: () => number;
  agendar?: (fn: () => void) => void;
}

export interface Captura {
  desinstalar(): void;
  estatisticas(): { recebidas: number; publicadas: number; descartadas: number; erros: number };
}

interface JanelaComWs {
  WebSocket: typeof WebSocket;
  location: { href: string; host: string };
  setTimeout: (fn: () => void, ms?: number) => unknown;
  [MARCA_INSTALADO]?: Captura;
}

export function instalarCaptura(janela: JanelaComWs, opcoes: OpcoesCaptura): Captura {
  const existente = janela[MARCA_INSTALADO];
  if (existente) return existente;

  const Original = janela.WebSocket;
  const parse = JSON.parse.bind(JSON);
  const agora = opcoes.agora ?? Date.now;
  const agendar = opcoes.agendar ?? ((fn: () => void) => void janela.setTimeout(fn, 0));
  const hostJogo = janela.location.host;
  const fila: { bruto: string; em: number }[] = [];
  const stats = { recebidas: 0, publicadas: 0, descartadas: 0, erros: 0 };
  let agendado = false;

  const processar = () => {
    agendado = false;
    const lote = fila.splice(0, LOTE_POR_CICLO);
    for (const { bruto, em } of lote) {
      try {
        if (PREFIXO_IGNORADO.test(bruto)) continue;
        const msg: unknown = parse(bruto);
        if (!msg || typeof msg !== 'object') continue;
        const tipo = (msg as { t?: unknown }).t;
        if (typeof tipo !== 'string' || !TIPOS.has(tipo)) continue;
        opcoes.publicar({
          origem: ORIGEM_PONTE,
          v: VERSAO_PONTE,
          tipo: 'mensagem',
          recebidoEm: em,
          dados: removerSensiveis(msg),
        });
        stats.publicadas++;
      } catch {
        stats.erros++;
      }
    }
    if (fila.length > 0) agendarProcessamento();
  };

  const agendarProcessamento = () => {
    if (agendado) return;
    agendado = true;
    agendar(processar);
  };

  const enfileirar = (bruto: string) => {
    stats.recebidas++;
    if (fila.length >= LIMITE_FILA) {
      fila.shift();
      stats.descartadas++;
    }
    fila.push({ bruto, em: agora() });
    agendarProcessamento();
  };

  const deveObservar = (url: string | URL) => {
    try {
      return new URL(String(url), janela.location.href).host === hostJogo;
    } catch {
      return false;
    }
  };

  class WebSocketObservado extends Original {
    constructor(url: string | URL, protocolos?: string | string[]) {
      super(url, protocolos);
      if (!deveObservar(url)) return;
      this.addEventListener('message', (ev: MessageEvent) => {
        if (typeof ev.data === 'string') enfileirar(ev.data);
      });
    }
  }
  Object.defineProperty(WebSocketObservado, 'name', { value: 'WebSocket' });

  janela.WebSocket = WebSocketObservado;

  const captura: Captura = {
    desinstalar() {
      janela.WebSocket = Original;
      Reflect.deleteProperty(janela, MARCA_INSTALADO);
    },
    estatisticas: () => ({ ...stats }),
  };
  janela[MARCA_INSTALADO] = captura;
  return captura;
}
