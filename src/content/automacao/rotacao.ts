import type { CriterioRotacao } from '../../shared/preferenciasAutomacao';
import type { ContextoAutomacao } from './contexto';

export interface CandidataRotacao {
  slug: string;
  nivel: number;
  lucroH: number | null;
  xpH: number;
  goldH: number;
}

export interface OpcoesRotacao {
  criterio: () => CriterioRotacao;
  candidatas: () => readonly CandidataRotacao[];
  viajar: (slug: string) => void;
}

function valor(c: CandidataRotacao, criterio: CriterioRotacao): number {
  if (criterio === 'xp') return c.xpH;
  if (criterio === 'nivel') return c.nivel;
  return c.lucroH ?? c.goldH;
}

export function escolherHunt(
  candidatas: readonly CandidataRotacao[],
  nivelTreinador: number,
  criterio: CriterioRotacao,
): CandidataRotacao | null {
  let melhor: CandidataRotacao | null = null;
  for (const c of candidatas) {
    if (c.nivel > nivelTreinador) continue;
    if (!melhor) {
      melhor = c;
      continue;
    }
    const diferenca = valor(c, criterio) - valor(melhor, criterio);
    const desempate = criterio === 'nivel' ? valor(c, 'lucro') - valor(melhor, 'lucro') : 0;
    if (diferenca > 0 || (diferenca === 0 && desempate > 0)) melhor = c;
  }
  return melhor;
}

export class Rotacao {
  private nivelVisto: number | null = null;

  constructor(
    private readonly ctx: ContextoAutomacao,
    private readonly o: OpcoesRotacao,
  ) {}

  reiniciar(): void {
    this.nivelVisto = null;
  }

  tique(): string | null {
    const j = this.ctx.jogador();
    const nivel = j?.level;
    if (!j || nivel === undefined) return null;
    const anterior = this.nivelVisto;
    this.nivelVisto = nivel;
    if (anterior === null || nivel <= anterior) return null;
    const candidatas = this.o.candidatas();
    const liberouNova = candidatas.some((c) => c.nivel > anterior && c.nivel <= nivel);
    if (!liberouNova) return null;
    const destino = escolherHunt(candidatas, nivel, this.o.criterio());
    if (!destino || destino.slug === j.huntSlug) return null;
    this.ctx.log.info('Rotação: hunt nova liberada', {
      nivel,
      destino: destino.slug,
      criterio: this.o.criterio(),
    });
    this.o.viajar(destino.slug);
    return destino.slug;
  }
}
