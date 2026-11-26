import { describe, expect, it, vi } from 'vitest';
import { escutarPonte } from '../../src/bridge/receptor';
import { logDeTeste } from '../helpers/log';

const origem = window.location.origin;
const valido = {
  origem: 'pokeidle-helper',
  v: 1,
  tipo: 'mensagem',
  recebidoEm: 1,
  dados: { t: 'estado' },
};
const enviar = (data: unknown, opcoes: Partial<MessageEventInit> = {}) =>
  window.dispatchEvent(
    new MessageEvent('message', { data, origin: origem, source: window, ...opcoes }),
  );

describe('receptor da ponte', () => {
  it('aceita só envelopes válidos da própria página', () => {
    const { log, memoria } = logDeTeste();
    const recebido = vi.fn();
    const parar = escutarPonte(window, origem, recebido, log);
    enviar(valido);
    enviar(valido, { origin: 'https://malicioso.example' });
    enviar(valido, { source: null });
    enviar({ ...valido, origem: 'outro' });
    enviar(null);
    enviar({ ...valido, v: 2 });
    expect(recebido).toHaveBeenCalledTimes(1);
    expect(recebido.mock.calls[0]![0]).toEqual(valido);
    expect(memoria.entradas.filter((e) => e.nivel === 'WARN')).toHaveLength(1);
    parar();
    enviar(valido);
    expect(recebido).toHaveBeenCalledTimes(1);
  });

  it('contém erros do processador', () => {
    const { log, memoria } = logDeTeste();
    const parar = escutarPonte(
      window,
      origem,
      () => {
        throw new Error('quebrou');
      },
      log,
    );
    expect(() => enviar(valido)).not.toThrow();
    expect(memoria.entradas.some((e) => e.nivel === 'ERROR')).toBe(true);
    parar();
  });
});
