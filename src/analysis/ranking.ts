import type { CatalogoEspecies } from '../domain/catalogo';
import type { Hunt, PokemonJogador, TabelaTipos } from '../domain/schemas';
import type { Sessao } from '../domain/sessao';
import { avaliarHunt, melhorDoTime, tiposDoPokemon, type AvaliacaoTipo } from './dicasTipo';
import { abatesPorHoraTeorico, mediaPorAbate } from './formulasJogo';
import { agregar, mediana, taxasDe, type Precos } from './taxas';

export type Fonte = 'real' | 'real-pouca-amostra' | 'estimado' | 'teorico';
export type Criterio = 'lucro' | 'xp';

export interface LinhaRanking {
  slug: string;
  nome: string;
  nivel: number;
  regiao?: string;
  fonte: Fonte;
  sessoes: number;
  msAtivo: number;
  xpH: number;
  goldH: number;
  custoH: number | null;
  lucroH: number | null;
  abatesH: number;
  tipo: AvaliacaoTipo;
  melhorPokemon?: PokemonJogador;
}

export interface EntradaRanking {
  hunts: readonly Hunt[];
  sessoes: readonly Sessao[];
  catalogo: CatalogoEspecies;
  tabela: TabelaTipos;
  ativo?: PokemonJogador;
  time: readonly PokemonJogador[];
  precos: Precos;
  amostraMinimaMs: number;
}

export interface ResultadoRanking {
  linhas: LinhaRanking[];
  fatorEficiencia: number | null;
  custoPorAbate: number | null;
}

export function montarRanking(e: EntradaRanking): ResultadoRanking {
  const porHunt = new Map<string, Sessao[]>();
  for (const s of e.sessoes) {
    const lista = porHunt.get(s.huntSlug) ?? [];
    lista.push(s);
    porHunt.set(s.huntSlug, lista);
  }

  const reais = new Map<string, ReturnType<typeof taxasDe> & { sessoes: number }>();
  const eficiencias: number[] = [];
  const custosPorAbate: number[] = [];
  for (const hunt of e.hunts) {
    const sessoes = porHunt.get(hunt.slug);
    if (!sessoes?.length) continue;
    const total = agregar(sessoes);
    const taxas = taxasDe(total, e.precos);
    reais.set(hunt.slug, { ...taxas, sessoes: total.sessoes });
    if (total.msAtivo >= e.amostraMinimaMs) {
      eficiencias.push(taxas.abatesH / abatesPorHoraTeorico(hunt));
      if (total.abates > 0) custosPorAbate.push(taxas.custoPorAbate);
    }
  }
  const fator = mediana(eficiencias);
  const custoPorAbate = mediana(custosPorAbate);
  const tiposAtivo = tiposDoPokemon(e.ativo, e.catalogo);

  const linhas = e.hunts.map((hunt): LinhaRanking => {
    const tipo = avaliarHunt(hunt, tiposAtivo, e.catalogo, e.tabela);
    const sugestao = melhorDoTime(hunt, e.time, e.catalogo, e.tabela);
    const base = {
      slug: hunt.slug,
      nome: hunt.nome || hunt.slug,
      nivel: hunt.nivel,
      ...(hunt.regiao ? { regiao: hunt.regiao } : {}),
      tipo,
      ...(sugestao ? { melhorPokemon: sugestao.pokemon } : {}),
    };
    const real = reais.get(hunt.slug);
    if (real) {
      return {
        ...base,
        fonte: real.msAtivo >= e.amostraMinimaMs ? 'real' : 'real-pouca-amostra',
        sessoes: real.sessoes,
        msAtivo: real.msAtivo,
        xpH: real.xpPokemonH,
        goldH: real.goldH,
        custoH: real.custoH,
        lucroH: real.lucroLiquidoH,
        abatesH: real.abatesH,
      };
    }
    const media = mediaPorAbate(hunt);
    const abatesH = abatesPorHoraTeorico(hunt) * (fator ?? 1);
    const custoH = custoPorAbate !== null ? custoPorAbate * abatesH : null;
    const goldH = media.gold * abatesH;
    return {
      ...base,
      fonte: fator !== null ? 'estimado' : 'teorico',
      sessoes: 0,
      msAtivo: 0,
      xpH: media.xp * abatesH,
      goldH,
      custoH,
      lucroH: custoH !== null ? goldH - custoH : null,
      abatesH,
    };
  });

  return { linhas, fatorEficiencia: fator, custoPorAbate };
}

const PESO_FONTE: Record<Fonte, number> = {
  real: 0,
  'real-pouca-amostra': 1,
  estimado: 2,
  teorico: 3,
};

export function ordenar(
  linhas: readonly LinhaRanking[],
  criterio: Criterio,
  nivelMaximo?: number,
): LinhaRanking[] {
  const valor = (l: LinhaRanking) => (criterio === 'xp' ? l.xpH : (l.lucroH ?? l.goldH));
  return linhas
    .filter((l) => nivelMaximo === undefined || l.nivel <= nivelMaximo)
    .toSorted(
      (a, b) =>
        valor(b) - valor(a) || PESO_FONTE[a.fonte] - PESO_FONTE[b.fonte] || a.nivel - b.nivel,
    );
}
