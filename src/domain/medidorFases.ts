export interface Fases {
  lutaMs: number;
  deslocamentoMs: number;
  esperaMs: number;
  ondas: number;
}

export const FASES_ZERADAS: Readonly<Fases> = Object.freeze({
  lutaMs: 0,
  deslocamentoMs: 0,
  esperaMs: 0,
  ondas: 0,
});

type Fase = 'luta' | 'deslocamento' | 'espera';

export interface EventoDeFase {
  k: string;
  por?: string | undefined;
  quem?: string | number | undefined;
}

const CHAVE: Record<Fase, keyof Omit<Fases, 'ondas'>> = {
  luta: 'lutaMs',
  deslocamento: 'deslocamentoMs',
  espera: 'esperaMs',
};

export class MedidorFases {
  private fases: Fases = { ...FASES_ZERADAS };
  private fase: Fase | null = null;
  private desde = 0;
  private vivos = 0;

  constructor(private readonly pausaMaximaMs: number) {}

  registrar(ev: EventoDeFase, em: number): void {
    if (ev.k === 'spawn') {
      if (this.vivos === 0) this.fases.ondas++;
      this.vivos++;
      if (this.fase !== 'luta') this.mudar('deslocamento', em);
      return;
    }
    if (ev.k === 'ataque' && ev.por === 'jogador') {
      if (this.fase !== 'luta') this.mudar('luta', em);
      return;
    }
    if (ev.k === 'morte' && ev.quem === 'selvagem') {
      this.vivos = Math.max(0, this.vivos - 1);
      this.mudar(this.vivos > 0 ? 'deslocamento' : 'espera', em);
    }
  }

  resultado(): Fases {
    return { ...this.fases };
  }

  fechar(em: number): void {
    if (!this.fase) return;
    this.mudar(this.fase, em);
    this.fase = null;
  }

  reiniciar(): void {
    this.fases = { ...FASES_ZERADAS };
    this.fase = null;
    this.desde = 0;
    this.vivos = 0;
  }

  private mudar(nova: Fase, em: number) {
    if (this.fase) {
      const duracao = em - this.desde;
      if (duracao > 0 && duracao <= this.pausaMaximaMs) this.fases[CHAVE[this.fase]] += duracao;
    }
    this.fase = nova;
    this.desde = em;
  }
}
