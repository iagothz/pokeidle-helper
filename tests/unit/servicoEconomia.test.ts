import { describe, expect, it } from 'vitest';
import { montarEconomia } from '../../src/content/servicoEconomia';
import { chanceFragmentoOvoShiny } from '../../src/analysis/economia';
import { CAPTURA_PADRAO } from '../../src/domain/parametros';
import type { Hunt } from '../../src/domain/schemas';
import { catalogos } from '../helpers/catalogos';

const { especies } = catalogos();
const hunt: Hunt = {
  slug: 'geodude',
  nome: 'Geodude',
  nivel: 6000,
  especies: [{ pokeId: 74, pontos: 4 }],
};
const bolas = [
  { id: 1, name: 'Poke Ball', priceGold: 50, catchRate: 1 },
  { id: 2, name: 'Great Ball', priceGold: 300, catchRate: 2 },
];

describe('montarEconomia', () => {
  it('junta captura, shiny, pedras e ovo shiny no ritmo dado', () => {
    const e = montarEconomia({
      hunt,
      todasHunts: [hunt],
      especies,
      bolas,
      inventarioBolas: { '2': 10 },
      captura: CAPTURA_PADRAO,
      chanceShiny: 0.001,
      abatesH: 600,
      fonteRitmo: 'sessao',
      sessao: { capturas: 3, fugas: 9, bolasUsadas: 12, msAtivo: 3_600_000 },
      fragmentosOvo: 4,
    });
    expect(e.capturas[0]!.porBola.map((b) => b.bolaId)).toEqual([1, 2]);
    expect(e.bolasNoInventario).toEqual(new Set([2]));
    expect(e.taxaRealCaptura).toBe(0.25);
    expect(e.shiny).toEqual({ arremessosPorShiny: 1000, msAteShiny: (1000 / 12) * 3_600_000 });
    expect(e.pedrasH.find((p) => p.nome === 'Rock Stone')?.porHora).toBeCloseTo(600 * 0.005, 10);
    const chance = chanceFragmentoOvoShiny(hunt);
    expect(e.ovoShiny).toEqual({
      chancePorAbate: chance,
      fragmentos: 4,
      faltam: 6,
      msAte: (6 / (600 * chance)) * 3_600_000,
    });
  });

  it('sem sessão, sem shiny e abaixo do nível do ovo os campos ficam vazios', () => {
    const e = montarEconomia({
      hunt: { ...hunt, nivel: 10 },
      todasHunts: [hunt],
      especies,
      bolas,
      inventarioBolas: {},
      captura: CAPTURA_PADRAO,
      chanceShiny: null,
      abatesH: 0,
      fonteRitmo: 'nenhum',
      sessao: null,
      fragmentosOvo: 0,
    });
    expect(e.taxaRealCaptura).toBeNull();
    expect(e.shiny).toBeNull();
    expect(e.ovoShiny).toBeNull();
    expect(e.pedrasH.every((p) => p.porHora === 0)).toBe(true);
  });
});
