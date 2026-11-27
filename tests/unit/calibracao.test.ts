import { describe, expect, it } from 'vitest';
import { AMOSTRA_CALIBRACAO_MS, calibrar } from '../../src/analysis/calibracao';

describe('calibrar', () => {
  it('usa a mediana da razão real ÷ simulado das sessões com amostra', () => {
    const r = calibrar([
      { abatesReais: 100, msAtivo: 3_600_000, abatesHSimulado: 200 },
      { abatesReais: 60, msAtivo: 3_600_000, abatesHSimulado: 100 },
      { abatesReais: 1000, msAtivo: AMOSTRA_CALIBRACAO_MS - 1, abatesHSimulado: 1 },
      { abatesReais: 80, msAtivo: 3_600_000, abatesHSimulado: 100 },
    ]);
    expect(r).toEqual({ fator: 0.6, sessoes: 3 });
  });

  it('sem amostras válidas não calibra e limita valores extremos', () => {
    expect(calibrar([])).toBeNull();
    expect(calibrar([{ abatesReais: 10, msAtivo: 3_600_000, abatesHSimulado: 0 }])).toBeNull();
    expect(calibrar([{ abatesReais: 10_000, msAtivo: 3_600_000, abatesHSimulado: 1 }])?.fator).toBe(
      5,
    );
    expect(calibrar([{ abatesReais: 1, msAtivo: 3_600_000, abatesHSimulado: 10_000 }])?.fator).toBe(
      0.1,
    );
  });
});
