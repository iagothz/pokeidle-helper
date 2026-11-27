import { describe, expect, it } from 'vitest';
import {
  AMOSTRA_CALIBRACAO_MS,
  calibrar,
  calibrarComponentes,
} from '../../src/analysis/calibracao';

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
      20,
    );
    expect(
      calibrar([{ abatesReais: 1, msAtivo: 3_600_000, abatesHSimulado: 100_000 }])?.fator,
    ).toBe(0.05);
  });
});

describe('calibrarComponentes', () => {
  const base = {
    abatesReais: 100,
    msAtivo: 3_600_000,
    golpesReais: 500,
    golpesSimulados: 50,
    deslocamentoMs: 200_000,
    esperaMs: 100_000,
    ondas: 20,
  };

  it('dano pela mediana de golpes simulados ÷ reais e tempos somados', () => {
    const r = calibrarComponentes([
      base,
      {
        ...base,
        golpesReais: 200,
        golpesSimulados: 50,
        deslocamentoMs: 100_000,
        esperaMs: 0,
        ondas: 0,
      },
      { ...base, golpesReais: 100, golpesSimulados: 100, abatesReais: 100 },
    ]);
    expect(r).toEqual({
      fatorDano: 0.25,
      deslocamentoPorAbateS: 500 / 300,
      esperaPorOndaS: 200 / 40,
      sessoes: 3,
    });
  });

  it('ignora amostras curtas ou sem golpes e devolve nulo sem dados', () => {
    expect(calibrarComponentes([])).toBeNull();
    expect(calibrarComponentes([{ ...base, msAtivo: AMOSTRA_CALIBRACAO_MS - 1 }])).toBeNull();
    const semGolpes = calibrarComponentes([{ ...base, golpesReais: 0 }]);
    expect(semGolpes).toMatchObject({ fatorDano: null, sessoes: 1 });
    const semOndas = calibrarComponentes([{ ...base, ondas: 0 }]);
    expect(semOndas?.esperaPorOndaS).toBeNull();
  });
});
