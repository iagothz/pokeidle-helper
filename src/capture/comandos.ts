import {
  LimitadorComandos,
  ORIGEM_COMANDO,
  esquemaComando,
  esquemaEnvelopeComando,
  type MotivoRecusa,
  type ResultadoComando,
} from '../shared/comandos';
import type { SocketJogo } from './hook';

const ABERTO = 1;

export interface JanelaComandos {
  addEventListener(tipo: 'message', fn: (ev: MessageEvent) => void): void;
  removeEventListener(tipo: 'message', fn: (ev: MessageEvent) => void): void;
}

export interface OpcoesComandos {
  janela: JanelaComandos;
  origem: string;
  socket: () => SocketJogo | null;
  responder: (r: ResultadoComando) => void;
  agora?: () => number;
  limitador?: LimitadorComandos;
}

export function instalarComandos(o: OpcoesComandos): () => void {
  const agora = o.agora ?? Date.now;
  const limitador = o.limitador ?? new LimitadorComandos();
  const stringify = JSON.stringify.bind(JSON);

  const recusar = (id: number, t: string, motivo: MotivoRecusa) =>
    o.responder({ id, t, enviado: false, motivo });

  const ouvinte = (ev: MessageEvent) => {
    if (ev.source !== o.janela || ev.origin !== o.origem) return;
    const bruto = ev.data as { origem?: unknown } | null;
    if (!bruto || bruto.origem !== ORIGEM_COMANDO) return;
    const envelope = esquemaEnvelopeComando.safeParse(bruto);
    if (!envelope.success) return;
    const { id } = envelope.data;
    const comando = esquemaComando.safeParse(envelope.data.comando);
    const tipoBruto = (envelope.data.comando as { t?: unknown } | null)?.t;
    const t = typeof tipoBruto === 'string' ? tipoBruto.slice(0, 40) : '?';
    if (!comando.success) return recusar(id, t, 'invalido');
    if (!limitador.permitir(comando.data.t, agora())) return recusar(id, t, 'limite');
    const socket = o.socket();
    if (!socket || socket.readyState !== ABERTO) return recusar(id, t, 'sem-conexao');
    try {
      socket.send(stringify(comando.data));
    } catch {
      return recusar(id, t, 'erro');
    }
    o.responder({ id, t, enviado: true });
  };

  o.janela.addEventListener('message', ouvinte);
  return () => o.janela.removeEventListener('message', ouvinte);
}
