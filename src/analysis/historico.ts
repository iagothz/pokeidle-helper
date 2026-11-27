import type { Sessao } from '../domain/sessao';
import { agregar, taxasDe, type Precos } from './taxas';

export const LIMITE_HISTORICO = 50;

export interface LinhaHistorico {
  id: string;
  huntSlug: string;
  huntNome: string;
  inicio: number;
  msAtivo: number;
  xpPokemonH: number;
  lucroH: number;
  vendasAutoH: number;
  desmaios: number;
}

export interface ResumoHistorico {
  sessoes: number;
  msAtivo: number;
  xpPokemonH: number;
  lucroH: number;
  vendasAutoH: number;
}

export interface Historico {
  linhas: LinhaHistorico[];
  hunts: { slug: string; nome: string }[];
  resumo: ResumoHistorico | null;
  total: number;
}

export function montarHistorico(
  sessoes: readonly Sessao[],
  precos: Precos,
  filtroSlug?: string,
  limite = LIMITE_HISTORICO,
): Historico {
  const nomes = new Map<string, string>();
  for (const s of sessoes) if (!nomes.has(s.huntSlug)) nomes.set(s.huntSlug, s.huntNome);
  const hunts = [...nomes]
    .map(([slug, nome]) => ({ slug, nome }))
    .toSorted((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  const filtradas = sessoes
    .filter((s) => !filtroSlug || s.huntSlug === filtroSlug)
    .toSorted((a, b) => b.inicio - a.inicio);
  if (filtradas.length === 0) return { linhas: [], hunts, resumo: null, total: 0 };

  const linhas = filtradas.slice(0, Math.max(1, limite)).map((s): LinhaHistorico => {
    const t = taxasDe(s, precos);
    return {
      id: s.id,
      huntSlug: s.huntSlug,
      huntNome: s.huntNome,
      inicio: s.inicio,
      msAtivo: s.msAtivo,
      xpPokemonH: t.xpPokemonH,
      lucroH: t.lucroLiquidoH,
      vendasAutoH: t.vendasAutoH,
      desmaios: s.desmaios ?? 0,
    };
  });
  const total = taxasDe(agregar(filtradas), precos);
  return {
    linhas,
    hunts,
    total: filtradas.length,
    resumo: {
      sessoes: filtradas.length,
      msAtivo: total.msAtivo,
      xpPokemonH: total.xpPokemonH,
      lucroH: total.lucroLiquidoH,
      vendasAutoH: total.vendasAutoH,
    },
  };
}
