import { render } from 'preact';
import type { Aplicacao } from '../content/aplicacao';
import { Painel, type AcoesPainel } from './Painel';
import { ESTILOS } from './estilos';

export const ID_RAIZ = 'pokeidle-helper-raiz';

export function montarInterface(
  documento: Document,
  app: Aplicacao,
  acoes: AcoesPainel,
): { raiz: ShadowRoot; desmontar(): void } {
  documento.getElementById(ID_RAIZ)?.remove();
  const hospedeiro = documento.createElement('div');
  hospedeiro.id = ID_RAIZ;
  const raiz = hospedeiro.attachShadow({ mode: 'open' });
  const estilo = documento.createElement('style');
  estilo.textContent = ESTILOS;
  raiz.appendChild(estilo);
  const conteiner = documento.createElement('div');
  raiz.appendChild(conteiner);
  documento.documentElement.appendChild(hospedeiro);
  render(<Painel app={app} acoes={acoes} />, conteiner);
  return {
    raiz,
    desmontar() {
      render(null, conteiner);
      hospedeiro.remove();
    },
  };
}

export function baixarJson(
  documento: Document,
  raiz: ShadowRoot,
  nomeArquivo: string,
  dados: unknown,
): void {
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = documento.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  raiz.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
