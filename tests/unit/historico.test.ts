import { describe, expect, it } from 'vitest';
import { LIMITE_HISTORICO, montarHistorico } from '../../src/analysis/historico';
import { novaSessao, type Sessao } from '../../src/domain/sessao';
import { catalogos } from '../helpers/catalogos';

const HORA = 3_600_000;
const { precos } = catalogos();

function sessao(slug: string, inicio: number, extra: Partial<Sessao> = {}): Sessao {
  return {
    ...novaSessao(slug, slug.toUpperCase(), inicio),
    msAtivo: HORA,
    xpPokemon: 1000,
    gold: 500,
    pocoes: { '11': 1 },
    aberta: false,
    ...extra,
  };
}

describe('montarHistorico', () => {
  const sessoes = [
    sessao('a', 1000),
    sessao('b', 3000, { desmaios: 2 }),
    sessao('a', 2000, { msAtivo: 2 * HORA, xpPokemon: 4000 }),
  ];

  it('lista as sessões da mais recente para a mais antiga com taxas por hora', () => {
    const h = montarHistorico(sessoes, precos);
    expect(h.linhas.map((l) => l.id)).toEqual(['b-3000', 'a-2000', 'a-1000']);
    expect(h.linhas[0]).toMatchObject({
      huntNome: 'B',
      msAtivo: HORA,
      xpPokemonH: 1000,
      lucroH: 400,
      desmaios: 2,
    });
    expect(h.hunts).toEqual([
      { slug: 'a', nome: 'A' },
      { slug: 'b', nome: 'B' },
    ]);
  });

  it('filtra por hunt e resume o total do filtro', () => {
    const h = montarHistorico(sessoes, precos, 'a');
    expect(h.linhas.map((l) => l.id)).toEqual(['a-2000', 'a-1000']);
    expect(h.resumo).toMatchObject({ sessoes: 2, msAtivo: 3 * HORA, xpPokemonH: 5000 / 3 });
    expect(h.resumo?.lucroH).toBeCloseTo((1000 - 200) / 3, 6);
  });

  it('sem sessões não tem resumo; pagina as linhas e informa o total', () => {
    expect(montarHistorico([], precos)).toEqual({ linhas: [], hunts: [], resumo: null, total: 0 });
    const muitas = Array.from({ length: LIMITE_HISTORICO + 5 }, (_, i) => sessao('a', i));
    const h = montarHistorico(muitas, precos);
    expect(h.linhas).toHaveLength(LIMITE_HISTORICO);
    expect(h.total).toBe(LIMITE_HISTORICO + 5);
    expect(h.resumo?.sessoes).toBe(LIMITE_HISTORICO + 5);
    expect(montarHistorico(muitas, precos, undefined, 1_000).linhas).toHaveLength(
      LIMITE_HISTORICO + 5,
    );
  });
});
