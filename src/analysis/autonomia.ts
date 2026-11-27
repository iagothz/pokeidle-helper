export const AMOSTRA_MINIMA_MS = 5 * 60_000;
export const USOS_MINIMOS = 3;
const MS_HORA = 3_600_000;

export type CategoriaConsumivel = 'pocao' | 'revive' | 'bola';

export interface EntradaAutonomia {
  msAtivo: number;
  consumo: {
    pocoes: Readonly<Record<string, number>>;
    revives: Readonly<Record<string, number>>;
    bolas: Readonly<Record<string, number>>;
  };
  estoque: {
    itens: Readonly<Record<string, number>>;
    bolas: Readonly<Record<string, number>>;
  };
  nome: (categoria: CategoriaConsumivel, id: string) => string;
}

export interface LinhaAutonomia {
  categoria: CategoriaConsumivel;
  id: string;
  nome: string;
  usados: number;
  porHora: number;
  estoque: number;
  suficiente: boolean;
  msRestante: number | null;
}

export interface Autonomia {
  linhas: LinhaAutonomia[];
  limitante: LinhaAutonomia | null;
}

export function calcularAutonomia(e: EntradaAutonomia): Autonomia {
  const horas = e.msAtivo / MS_HORA;
  const linha = (
    categoria: CategoriaConsumivel,
    id: string,
    usados: number,
    estoqueMapa: Readonly<Record<string, number>>,
  ): LinhaAutonomia => {
    const estoque = Math.max(0, Math.floor(Number(estoqueMapa[id]) || 0));
    const suficiente = e.msAtivo >= AMOSTRA_MINIMA_MS && usados >= USOS_MINIMOS;
    const porHora = horas > 0 ? usados / horas : 0;
    return {
      categoria,
      id,
      nome: e.nome(categoria, id),
      usados,
      porHora,
      estoque,
      suficiente,
      msRestante: suficiente && porHora > 0 ? (estoque / porHora) * MS_HORA : null,
    };
  };
  const linhas = [
    ...Object.entries(e.consumo.pocoes).map(([id, q]) => linha('pocao', id, q, e.estoque.itens)),
    ...Object.entries(e.consumo.revives).map(([id, q]) => linha('revive', id, q, e.estoque.itens)),
    ...Object.entries(e.consumo.bolas).map(([id, q]) => linha('bola', id, q, e.estoque.bolas)),
  ];
  const limitante =
    linhas
      .filter((l) => l.categoria !== 'bola' && l.msRestante !== null)
      .toSorted((a, b) => (a.msRestante ?? 0) - (b.msRestante ?? 0))[0] ?? null;
  return { linhas, limitante };
}
