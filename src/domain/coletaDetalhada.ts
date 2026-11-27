import { FASES_ZERADAS, type Fases } from './medidorFases';

export const MAX_REGISTROS_DETALHE = 50_000;

export interface Trecho {
  inicio: number;
  fim: number;
  pokemonId?: string;
  level?: number;
  tipoSazonal?: string | null;
  msAtivo: number;
  abates: number;
  golpesDados: number;
  danoCausado: number;
  xpPokemon: number;
  gold: number;
  desmaios: number;
  fases: Fases;
}

export interface AbateRegistrado {
  t: number;
  lv?: number;
  g: number;
  d: number;
  l: number;
  xp: number;
  o: number;
}

export type TipoConsumo = 'pocao' | 'revive' | 'bola' | 'captura' | 'desmaio';

export interface ConsumoRegistrado {
  t: number;
  k: TipoConsumo;
  id?: number;
  shiny?: boolean;
  sp?: number;
  lv?: number;
  q?: number;
  v?: number;
}

export interface Acumulados {
  msAtivo: number;
  abates: number;
  golpesDados: number;
  danoCausado: number;
  xpPokemon: number;
  gold: number;
  desmaios: number;
  fases: Fases;
}

export interface IdentidadeTrecho {
  pokemonId?: string;
  level?: number;
  tipoSazonal?: string | null;
}

export function acumuladosDe(s: Acumulados): Acumulados {
  return {
    msAtivo: s.msAtivo,
    abates: s.abates,
    golpesDados: s.golpesDados,
    danoCausado: s.danoCausado,
    xpPokemon: s.xpPokemon,
    gold: s.gold,
    desmaios: s.desmaios,
    fases: { ...s.fases },
  };
}

export const ACUMULADOS_ZERADOS: Readonly<Acumulados> = Object.freeze({
  msAtivo: 0,
  abates: 0,
  golpesDados: 0,
  danoCausado: 0,
  xpPokemon: 0,
  gold: 0,
  desmaios: 0,
  fases: FASES_ZERADAS,
});

function diferencaFases(a: Fases, b: Fases): Fases {
  return {
    lutaMs: a.lutaMs - b.lutaMs,
    deslocamentoMs: a.deslocamentoMs - b.deslocamentoMs,
    esperaMs: a.esperaMs - b.esperaMs,
    ondas: a.ondas - b.ondas,
  };
}

export class TrechoAberto {
  private base: Acumulados;

  constructor(
    readonly inicio: number,
    atual: Acumulados,
    public identidade: IdentidadeTrecho,
  ) {
    this.base = acumuladosDe(atual);
  }

  identificar(parcial: IdentidadeTrecho): void {
    this.identidade = { ...parcial, ...this.identidade };
  }

  muda(outra: IdentidadeTrecho): boolean {
    const i = this.identidade;
    return (
      (i.pokemonId !== undefined && outra.pokemonId !== i.pokemonId) ||
      (i.level !== undefined && outra.level !== undefined && outra.level !== i.level)
    );
  }

  fechar(fim: number, atual: Acumulados): Trecho {
    const b = this.base;
    return {
      inicio: this.inicio,
      fim: Math.max(this.inicio, fim),
      ...(this.identidade.pokemonId !== undefined ? { pokemonId: this.identidade.pokemonId } : {}),
      ...(this.identidade.level !== undefined ? { level: this.identidade.level } : {}),
      ...(this.identidade.tipoSazonal !== undefined
        ? { tipoSazonal: this.identidade.tipoSazonal }
        : {}),
      msAtivo: atual.msAtivo - b.msAtivo,
      abates: atual.abates - b.abates,
      golpesDados: atual.golpesDados - b.golpesDados,
      danoCausado: atual.danoCausado - b.danoCausado,
      xpPokemon: atual.xpPokemon - b.xpPokemon,
      gold: atual.gold - b.gold,
      desmaios: atual.desmaios - b.desmaios,
      fases: diferencaFases(atual.fases, b.fases),
    };
  }
}

export class ContadorAbate {
  private golpes = 0;
  private dano = 0;
  private primeiroGolpeEm: number | null = null;

  golpe(dano: number, em: number): void {
    this.golpes++;
    this.dano += dano;
    if (this.primeiroGolpeEm === null) this.primeiroGolpeEm = em;
  }

  abate(em: number, xp: number, ouro: number, level?: number): AbateRegistrado {
    const r: AbateRegistrado = {
      t: em,
      ...(level !== undefined ? { lv: level } : {}),
      g: this.golpes,
      d: this.dano,
      l: this.primeiroGolpeEm === null ? 0 : Math.max(0, em - this.primeiroGolpeEm),
      xp,
      o: ouro,
    };
    this.reiniciar();
    return r;
  }

  reiniciar(): void {
    this.golpes = 0;
    this.dano = 0;
    this.primeiroGolpeEm = null;
  }
}

export function anexarLimitado<T>(lista: T[], item: T): void {
  if (lista.length < MAX_REGISTROS_DETALHE) lista.push(item);
}
