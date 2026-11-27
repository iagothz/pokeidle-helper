import type { ContextoAutomacao } from './contexto';

export const INTERVALO_VIAGEM_MS = 1_000;
export const LIMITE_VIAGEM_MS = 60_000;

export type FimViagem = 'chegou' | 'tempo-esgotado' | 'cancelada' | 'troca-manual';

export interface StatusViagem {
  alvo: string;
  desde: number;
  tentativas: number;
}

export interface ResultadoViagem {
  alvo: string;
  fim: FimViagem;
  em: number;
  tentativas: number;
}

interface Andamento extends StatusViagem {
  ultimaTentativa: number | null;
  slugVisto: string | null;
}

export class Viagem {
  private andamento: Andamento | null = null;
  private _ultimo: ResultadoViagem | null = null;

  constructor(
    private readonly ctx: ContextoAutomacao,
    private readonly limites = { intervaloMs: INTERVALO_VIAGEM_MS, limiteMs: LIMITE_VIAGEM_MS },
  ) {}

  get status(): StatusViagem | null {
    if (!this.andamento) return null;
    const { alvo, desde, tentativas } = this.andamento;
    return { alvo, desde, tentativas };
  }

  get ultimo(): ResultadoViagem | null {
    return this._ultimo;
  }

  iniciar(alvo: string): void {
    const j = this.ctx.jogador();
    if (this.andamento) this.terminar(this.andamento, 'cancelada');
    this.andamento = {
      alvo,
      desde: this.ctx.agora(),
      tentativas: 0,
      ultimaTentativa: null,
      slugVisto: j?.huntSlug ?? null,
    };
    this.ctx.log.info('Viagem iniciada', { alvo });
    this.tique();
  }

  cancelar(): void {
    if (this.andamento) this.terminar(this.andamento, 'cancelada');
  }

  tique(): void {
    const a = this.andamento;
    if (!a) return;
    const agora = this.ctx.agora();
    const j = this.ctx.jogador();
    const slug = j?.huntSlug ?? null;
    if (j && slug === a.alvo && !j.noCentro) return this.terminar(a, 'chegou');
    if (slug !== a.slugVisto && slug !== null && slug !== a.alvo)
      return this.terminar(a, 'troca-manual');
    a.slugVisto = slug;
    if (agora - a.desde >= this.limites.limiteMs) return this.terminar(a, 'tempo-esgotado');
    if (a.ultimaTentativa !== null && agora - a.ultimaTentativa < this.limites.intervaloMs) return;
    a.ultimaTentativa = agora;
    if (this.ctx.enviar({ t: 'hunt.select', slug: a.alvo }, 'viagem')) a.tentativas++;
  }

  private terminar(a: Andamento, fim: FimViagem): void {
    this.andamento = null;
    this._ultimo = { alvo: a.alvo, fim, em: this.ctx.agora(), tentativas: a.tentativas };
    const ctx = { alvo: a.alvo, fim, tentativas: a.tentativas };
    if (fim === 'chegou' || fim === 'cancelada') this.ctx.log.info('Viagem encerrada', ctx);
    else this.ctx.log.warn('Viagem interrompida', ctx);
  }
}
