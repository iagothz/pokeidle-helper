import type { ContextoAutomacao } from './contexto';

export const ESPERA_TROCA_ATIVO_MS = 3_500;
export const TENTATIVAS_TROCA = 3;

export class MelhorAtivo {
  private slugTratado: string | null | undefined = undefined;
  private tentativas = 0;
  private ultimaTroca = -Infinity;

  constructor(
    private readonly ctx: ContextoAutomacao,
    private readonly melhorDaHunt: (slug: string) => string | null,
  ) {}

  tique(): string | null {
    const j = this.ctx.jogador();
    if (!j) return null;
    const slug = j.noCentro ? null : j.huntSlug;
    if (slug !== this.slugTratado) {
      this.slugTratado = slug;
      this.tentativas = 0;
    }
    if (!slug || this.tentativas >= TENTATIVAS_TROCA) return null;
    const alvo = this.melhorDaHunt(slug);
    if (!alvo || alvo === j.activeId) {
      this.tentativas = TENTATIVAS_TROCA;
      return null;
    }
    const agora = this.ctx.agora();
    if (agora - this.ultimaTroca < ESPERA_TROCA_ATIVO_MS) return null;
    if (!this.ctx.enviar({ t: 'team.active', pokemonId: alvo }, 'melhor-ativo')) return null;
    this.ultimaTroca = agora;
    this.tentativas++;
    this.ctx.log.info('Ativo trocado pelo melhor da hunt', { slug, pokemonId: alvo });
    return alvo;
  }
}
