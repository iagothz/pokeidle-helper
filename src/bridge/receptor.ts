import * as z from 'zod';
import { ORIGEM_PONTE, VERSAO_PONTE } from '../shared/protocolo';
import type { Logger } from '../shared/logger';

const esquemaEnvelope = z.object({
  origem: z.literal(ORIGEM_PONTE),
  v: z.literal(VERSAO_PONTE),
  tipo: z.enum(['mensagem', 'diagnostico']),
  recebidoEm: z.number(),
  dados: z.unknown(),
});

export type EnvelopeValido = z.infer<typeof esquemaEnvelope>;

export interface AlvoMensagens {
  addEventListener(tipo: 'message', fn: (ev: MessageEvent) => void): void;
  removeEventListener(tipo: 'message', fn: (ev: MessageEvent) => void): void;
}

export function escutarPonte(
  janela: AlvoMensagens,
  origemEsperada: string,
  aoReceber: (envelope: EnvelopeValido) => void,
  log: Logger,
): () => void {
  const ouvinte = (ev: MessageEvent) => {
    if (ev.source !== janela || ev.origin !== origemEsperada) return;
    const dados = ev.data as { origem?: unknown } | null;
    if (!dados || dados.origem !== ORIGEM_PONTE) return;
    const res = esquemaEnvelope.safeParse(dados);
    if (!res.success) {
      log.warn('Envelope da ponte com formato inesperado', { problemas: res.error.issues.length });
      return;
    }
    try {
      aoReceber(res.data);
    } catch (erro) {
      log.error('Falha ao processar mensagem da ponte', {
        erro: erro instanceof Error ? erro.message : String(erro),
      });
    }
  };
  janela.addEventListener('message', ouvinte);
  return () => janela.removeEventListener('message', ouvinte);
}
