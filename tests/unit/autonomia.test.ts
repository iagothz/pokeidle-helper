import { describe, expect, it } from 'vitest';
import { AMOSTRA_MINIMA_MS, USOS_MINIMOS, calcularAutonomia } from '../../src/analysis/autonomia';

const nome = (cat: string, id: string) => `${cat}-${id}`;
const HORA = 3_600_000;

describe('calcularAutonomia', () => {
  it('estima o tempo até acabar cada consumível e aponta o primeiro a acabar', () => {
    const r = calcularAutonomia({
      msAtivo: HORA,
      consumo: { pocoes: { '11': 60 }, revives: { '12': 4 }, bolas: { '1': 10 } },
      estoque: { itens: { '11': 30, '12': 10 }, bolas: { '1': 5 } },
      nome,
    });
    expect(r.linhas).toEqual([
      expect.objectContaining({
        categoria: 'pocao',
        id: '11',
        porHora: 60,
        estoque: 30,
        msRestante: HORA / 2,
      }),
      expect.objectContaining({
        categoria: 'revive',
        id: '12',
        porHora: 4,
        estoque: 10,
        msRestante: 2.5 * HORA,
      }),
      expect.objectContaining({
        categoria: 'bola',
        id: '1',
        porHora: 10,
        estoque: 5,
        msRestante: HORA / 2,
      }),
    ]);
    expect(r.limitante).toMatchObject({ id: '11', nome: 'pocao-11' });
  });

  it('bolas não limitam a permanência na hunt', () => {
    const r = calcularAutonomia({
      msAtivo: HORA,
      consumo: { pocoes: { '11': 10 }, revives: {}, bolas: { '1': 100 } },
      estoque: { itens: { '11': 100 }, bolas: { '1': 1 } },
      nome,
    });
    expect(r.limitante?.id).toBe('11');
  });

  it('marca como medindo enquanto a amostra é pequena', () => {
    const r = calcularAutonomia({
      msAtivo: AMOSTRA_MINIMA_MS - 1,
      consumo: { pocoes: { '11': 50 }, revives: { '12': USOS_MINIMOS - 1 }, bolas: {} },
      estoque: { itens: { '11': 10, '12': 1 }, bolas: {} },
      nome,
    });
    expect(r.linhas.every((l) => !l.suficiente && l.msRestante === null)).toBe(true);
    expect(r.limitante).toBeNull();
  });

  it('exige usos mínimos por item mesmo com tempo suficiente', () => {
    const r = calcularAutonomia({
      msAtivo: HORA,
      consumo: { pocoes: { '11': USOS_MINIMOS - 1 }, revives: {}, bolas: {} },
      estoque: { itens: {}, bolas: {} },
      nome,
    });
    expect(r.linhas[0]).toMatchObject({ suficiente: false, estoque: 0, msRestante: null });
  });

  it('estoque zerado com amostra suficiente dá zero de autonomia', () => {
    const r = calcularAutonomia({
      msAtivo: HORA,
      consumo: { pocoes: { '11': 10 }, revives: {}, bolas: {} },
      estoque: { itens: { '11': 0 }, bolas: {} },
      nome,
    });
    expect(r.limitante).toMatchObject({ msRestante: 0 });
  });
});
