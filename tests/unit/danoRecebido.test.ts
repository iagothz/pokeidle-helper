import { describe, expect, it } from 'vitest';
import {
  AMOSTRA_MINIMA_GOLPES,
  FRACAO_PERIGO,
  avaliarDanoRecebido,
} from '../../src/analysis/danoRecebido';

describe('avaliarDanoRecebido', () => {
  it('sem amostra suficiente não conclui nada', () => {
    const r = avaliarDanoRecebido({
      golpesRecebidos: AMOSTRA_MINIMA_GOLPES - 1,
      golpesSuperEfetivos: AMOSTRA_MINIMA_GOLPES - 1,
      danoRecebido: 1000,
    });
    expect(r).toMatchObject({ suficiente: false, perigo: false });
  });

  it('com amostra, calcula fração super efetiva e dano médio', () => {
    const r = avaliarDanoRecebido({
      golpesRecebidos: 40,
      golpesSuperEfetivos: 10,
      danoRecebido: 2000,
    });
    expect(r).toEqual({
      golpes: 40,
      fracaoSuperEfetivos: 0.25,
      danoMedio: 50,
      suficiente: true,
      perigo: 0.25 >= FRACAO_PERIGO,
    });
  });

  it('marca perigo quando a fração super efetiva passa do limite', () => {
    const r = avaliarDanoRecebido({ golpesRecebidos: 20, golpesSuperEfetivos: 8, danoRecebido: 0 });
    expect(r.perigo).toBe(true);
    expect(
      avaliarDanoRecebido({ golpesRecebidos: 0, golpesSuperEfetivos: 0, danoRecebido: 0 }),
    ).toMatchObject({
      fracaoSuperEfetivos: 0,
      danoMedio: 0,
    });
  });
});
