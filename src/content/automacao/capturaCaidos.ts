import type { ContextoAutomacao } from './contexto';

export const SELETOR_CAIDOS = '#caidos-lista .caido';
export const INTERVALO_CLIQUE_MS = 1_100;
export const MAXIMO_CLIQUES_POR_CAIDO = 15;

export interface RaizDom {
  querySelectorAll(seletor: string): Iterable<Element>;
}

export function nomeDoCaido(linha: Element): string | null {
  const quem = linha.querySelector('.caido-quem');
  const texto = quem?.firstChild?.textContent ?? '';
  const nome = texto.replace(/\s+/g, ' ').trim();
  return nome || null;
}

export class CapturaCaidos {
  private ultimoClique = -Infinity;
  private readonly cliques = new Map<string, number>();

  constructor(
    private readonly ctx: ContextoAutomacao,
    private readonly raiz: RaizDom,
    private readonly especiePorNome: (nome: string) => number | undefined,
  ) {}

  tique(): string | null {
    const j = this.ctx.jogador();
    if (!j) return null;
    const agora = this.ctx.agora();
    const vistos = new Set<string>();
    let clicado: string | null = null;
    for (const linha of this.raiz.querySelectorAll(SELETOR_CAIDOS)) {
      const slot = (linha as HTMLElement).dataset?.slot ?? '';
      vistos.add(slot);
      if (clicado || agora - this.ultimoClique < INTERVALO_CLIQUE_MS) continue;
      const nome = nomeDoCaido(linha);
      const especie = nome ? this.especiePorNome(nome) : undefined;
      if (especie === undefined || j.especiesCapturadas.has(especie)) continue;
      const feitos = this.cliques.get(slot) ?? 0;
      if (feitos >= MAXIMO_CLIQUES_POR_CAIDO) continue;
      (linha as HTMLElement).click();
      this.cliques.set(slot, feitos + 1);
      this.ultimoClique = agora;
      clicado = nome;
      this.ctx.log.info('Bola arremessada em caído fora da pokédex', {
        especie,
        slot,
        tentativa: feitos + 1,
      });
    }
    for (const slot of this.cliques.keys()) if (!vistos.has(slot)) this.cliques.delete(slot);
    return clicado;
  }
}
