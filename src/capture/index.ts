import { instalarCaptura } from './hook';
import { ORIGEM_PONTE, VERSAO_PONTE } from '../shared/protocolo';

const destino = window.location.origin;
const postar = window.postMessage.bind(window);

try {
  const captura = instalarCaptura(window as unknown as Parameters<typeof instalarCaptura>[0], {
    publicar: (envelope) => postar(envelope, destino),
  });
  window.setInterval(() => {
    postar(
      {
        origem: ORIGEM_PONTE,
        v: VERSAO_PONTE,
        tipo: 'diagnostico',
        recebidoEm: Date.now(),
        dados: captura.estatisticas(),
      },
      destino,
    );
  }, 30_000);
} catch {
  void 0;
}
