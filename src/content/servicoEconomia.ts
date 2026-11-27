import {
  FRAGMENTOS_POR_OVO,
  analisarCaptura,
  chanceFragmentoOvoShiny,
  pedrasPorAbate,
  type CapturaDaEspecie,
} from '../analysis/economia';
import type { CatalogoEspecies } from '../domain/catalogo';
import type { ParametrosCaptura } from '../domain/parametros';
import type { Bola, Hunt } from '../domain/schemas';

const MS_HORA = 3_600_000;

export type FonteRitmo = 'sessao' | 'simulado' | 'nenhum';

export interface EntradaEconomia {
  hunt: Hunt;
  todasHunts: readonly Hunt[];
  especies: CatalogoEspecies;
  bolas: readonly Bola[];
  inventarioBolas: Readonly<Record<string, number>>;
  captura: ParametrosCaptura;
  chanceShiny: number | null;
  abatesH: number;
  fonteRitmo: FonteRitmo;
  sessao: { capturas: number; fugas: number; bolasUsadas: number; msAtivo: number } | null;
  fragmentosOvo: number;
}

export interface Economia {
  huntNome: string;
  abatesH: number;
  fonteRitmo: FonteRitmo;
  capturas: CapturaDaEspecie[];
  bolasNoInventario: Set<number>;
  taxaRealCaptura: number | null;
  shiny: { arremessosPorShiny: number; msAteShiny: number | null } | null;
  pedrasH: { nome: string; porHora: number }[];
  ovoShiny: {
    chancePorAbate: number;
    fragmentos: number;
    faltam: number;
    msAte: number | null;
  } | null;
}

export function montarEconomia(e: EntradaEconomia): Economia {
  const tentativas = e.sessao ? e.sessao.capturas + e.sessao.fugas : 0;
  const bolasPorHora =
    e.sessao && e.sessao.msAtivo > 0 ? e.sessao.bolasUsadas / (e.sessao.msAtivo / MS_HORA) : 0;
  const arremessosPorShiny = e.chanceShiny && e.chanceShiny > 0 ? 1 / e.chanceShiny : null;
  const chanceOvo = chanceFragmentoOvoShiny(e.hunt);
  const faltam = FRAGMENTOS_POR_OVO - (e.fragmentosOvo % FRAGMENTOS_POR_OVO);
  const ovosPorHora = e.abatesH * chanceOvo;
  return {
    huntNome: e.hunt.nome || e.hunt.slug,
    abatesH: e.abatesH,
    fonteRitmo: e.fonteRitmo,
    capturas: analisarCaptura(e.hunt, e.especies, e.bolas, e.captura, e.todasHunts),
    bolasNoInventario: new Set(
      Object.entries(e.inventarioBolas)
        .filter(([, q]) => q > 0)
        .map(([id]) => Number(id)),
    ),
    taxaRealCaptura: tentativas > 0 && e.sessao ? e.sessao.capturas / tentativas : null,
    shiny: arremessosPorShiny
      ? {
          arremessosPorShiny,
          msAteShiny: bolasPorHora > 0 ? (arremessosPorShiny / bolasPorHora) * MS_HORA : null,
        }
      : null,
    pedrasH: [...pedrasPorAbate(e.hunt, e.especies)]
      .map(([nome, porAbate]) => ({ nome, porHora: porAbate * e.abatesH }))
      .toSorted((a, b) => b.porHora - a.porHora),
    ovoShiny:
      chanceOvo > 0
        ? {
            chancePorAbate: chanceOvo,
            fragmentos: e.fragmentosOvo,
            faltam,
            msAte: ovosPorHora > 0 ? (faltam / ovosPorHora) * MS_HORA : null,
          }
        : null,
  };
}
