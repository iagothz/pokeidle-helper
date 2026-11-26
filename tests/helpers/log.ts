import { DestinoMemoria, GerenciadorLog } from '../../src/shared/logger';

export function logDeTeste() {
  const memoria = new DestinoMemoria();
  const gerenciador = new GerenciadorLog('DEBUG', () => 0);
  gerenciador.adicionarDestino(memoria);
  return { log: gerenciador.logger('teste'), memoria, gerenciador };
}
