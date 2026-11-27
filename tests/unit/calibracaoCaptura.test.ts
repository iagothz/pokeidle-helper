import { describe, expect, it } from 'vitest';
import {
  CAPTURAS_PRIOR,
  amostrasDeCaptura,
  calibrarChance,
  fatorGlobalCaptura,
  intervaloWilson,
} from '../../src/analysis/calibracaoCaptura';
import type { ConsumoRegistrado } from '../../src/domain/coletaDetalhada';
import { novaSessao, type Sessao } from '../../src/domain/sessao';

function sessao(
  slug: string,
  bolas: Record<string, number>,
  capturas: number,
  consumo: ConsumoRegistrado[] = [],
): Sessao {
  return { ...novaSessao(slug, slug, 0), id: `${slug}-${Math.random()}`, bolas, capturas, consumo };
}

describe('amostrasDeCaptura', () => {
  it('com uma bola só na sessão atribui todas as capturas a ela', () => {
    const r = amostrasDeCaptura([
      sessao('sunflora', { '4': 151 }, 4),
      sessao('sunflora', { '4': 336 }, 6),
    ]);
    expect(r).toEqual([{ huntSlug: 'sunflora', bolaId: 4, arremessos: 487, capturas: 10 }]);
  });

  it('com várias bolas usa a última bola antes de cada captura na linha do tempo', () => {
    const consumo: ConsumoRegistrado[] = [
      { t: 1, k: 'bola', id: 1 },
      { t: 2, k: 'captura' },
      { t: 3, k: 'bola', id: 4 },
      { t: 4, k: 'bola', id: 4 },
      { t: 5, k: 'captura' },
    ];
    const r = amostrasDeCaptura([sessao('sunkern', { '1': 1, '4': 2 }, 2, consumo)]);
    expect(r).toEqual([
      { huntSlug: 'sunkern', bolaId: 1, arremessos: 1, capturas: 1 },
      { huntSlug: 'sunkern', bolaId: 4, arremessos: 2, capturas: 1 },
    ]);
  });

  it('ignora sessões com várias bolas e sem linha do tempo', () => {
    expect(amostrasDeCaptura([sessao('x', { '1': 10, '4': 10 }, 1)])).toEqual([]);
  });
});

describe('intervaloWilson', () => {
  it('dá um intervalo de 95% em volta da taxa medida', () => {
    const [lo, hi] = intervaloWilson(10, 487) ?? [0, 0];
    expect(lo).toBeCloseTo(0.0112, 3);
    expect(hi).toBeCloseTo(0.0373, 3);
    expect(intervaloWilson(0, 0)).toBeNull();
  });
});

describe('fatorGlobalCaptura', () => {
  it('compara capturas observadas com as esperadas pela fórmula, puxado para 1 com pouca amostra', () => {
    const amostras = [
      { huntSlug: 'sunflora', bolaId: 4, arremessos: 487, capturas: 10 },
      { huntSlug: 'sunkern', bolaId: 4, arremessos: 170, capturas: 1 },
    ];
    const formula = (slug: string) => (slug === 'sunflora' ? 0.0094 : 0.0117);
    const f = fatorGlobalCaptura(amostras, formula);
    const esperadas = 487 * 0.0094 + 170 * 0.0117;
    expect(f.esperadas).toBeCloseTo(esperadas, 6);
    expect(f.capturas).toBe(11);
    expect(f.fator).toBeCloseTo((11 + CAPTURAS_PRIOR) / (esperadas + CAPTURAS_PRIOR), 6);
  });

  it('sem fórmula ou sem amostra o fator é 1', () => {
    expect(fatorGlobalCaptura([], () => 0.01).fator).toBe(1);
    expect(
      fatorGlobalCaptura([{ huntSlug: 'a', bolaId: 1, arremessos: 10, capturas: 1 }], () => null)
        .fator,
    ).toBe(1);
  });
});

describe('calibrarChance', () => {
  it('sem amostra usa a fórmula corrigida pelo fator global', () => {
    const c = calibrarChance(0.01, undefined, 1.5);
    expect(c).toMatchObject({ formula: 0.01, medida: null, intervalo: null, calibrada: 0.015 });
  });

  it('converge para a taxa medida quando a amostra cresce', () => {
    const pouco = calibrarChance(0.0094, { arremessos: 100, capturas: 2 }, 1);
    const muito = calibrarChance(0.0094, { arremessos: 50_000, capturas: 1_000 }, 1);
    expect(pouco.calibrada).toBeGreaterThan(0.0094);
    expect(pouco.calibrada).toBeLessThan(0.02);
    expect(muito.calibrada).toBeCloseTo(0.02, 3);
    expect(muito.medida).toBe(0.02);
  });

  it('com a amostra do Sunflora fica entre a fórmula e a medida', () => {
    const c = calibrarChance(0.0094, { arremessos: 487, capturas: 10 }, 1);
    expect(c.calibrada).toBeCloseTo((10 + CAPTURAS_PRIOR) / (487 + CAPTURAS_PRIOR / 0.0094), 6);
    expect(c.calibrada).toBeGreaterThan(0.0094);
    expect(c.calibrada).toBeLessThan(10 / 487);
  });

  it('respeita chance garantida e fórmula ausente', () => {
    expect(calibrarChance(1, { arremessos: 10, capturas: 10 }, 2).calibrada).toBe(1);
    expect(calibrarChance(null, { arremessos: 100, capturas: 5 }, 1).calibrada).toBe(0.05);
  });
});
