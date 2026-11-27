import { describe, expect, it } from 'vitest';
import {
  categoria,
  corDaNota,
  notaAutonomia,
  notaContagem,
  notaDinamica,
  notaGeral,
  notaGolpes,
  notaPercentil,
  notaRelativa,
  notaResistencia,
  notaSinal,
  notaSuperEfetivos,
  notaVsMelhor,
} from '../../src/ui/tons';

const UM_TERCO = 1 / 3;
const DOIS_TERCOS = 2 / 3;

describe('escala de cor', () => {
  it('vermelho em 0, branco em 0,5, verde em 1, contínua entre eles', () => {
    expect(corDaNota(0)).toBe('rgb(255, 93, 93)');
    expect(corDaNota(0.5)).toBe('rgb(241, 244, 248)');
    expect(corDaNota(1)).toBe('rgb(52, 210, 123)');
    expect(corDaNota(0.25)).toBe('rgb(248, 169, 171)');
    expect(corDaNota(-3)).toBe(corDaNota(0));
    expect(corDaNota(9)).toBe(corDaNota(1));
    expect(corDaNota(null)).toBeNull();
  });

  it('categoria da nota para bordas e resumo', () => {
    expect(categoria(0.9)).toBe('bom');
    expect(categoria(0.5)).toBe('neutro');
    expect(categoria(0.1)).toBe('ruim');
    expect(categoria(null)).toBe('apagado');
  });
});

describe('notas', () => {
  it('sinal: negativo 0, zero 0,5, positivo 1', () => {
    expect(notaSinal(-1)).toBe(0);
    expect(notaSinal(0)).toBe(0.5);
    expect(notaSinal(100)).toBe(1);
    expect(notaSinal(null)).toBeNull();
  });

  it('relativa: 90% e 110% da referência nos terços, contínua entre eles', () => {
    expect(notaRelativa(110, 100)).toBeCloseTo(DOIS_TERCOS, 10);
    expect(notaRelativa(90, 100)).toBeCloseTo(UM_TERCO, 10);
    expect(notaRelativa(100, 100)).toBeCloseTo(0.5, 10);
    expect(notaRelativa(200, 100)).toBe(1);
    expect(notaRelativa(10, 100)).toBe(0);
    expect(notaRelativa(50, null)).toBe(0.5);
  });

  it('autonomia: 15 min em 1/3, 1 h em 2/3, escala logarítmica', () => {
    expect(notaAutonomia(15 * 60_000)).toBeCloseTo(UM_TERCO, 10);
    expect(notaAutonomia(3_600_000)).toBeCloseTo(DOIS_TERCOS, 10);
    expect(notaAutonomia(4 * 3_600_000)).toBe(1);
    expect(notaAutonomia(60_000)).toBe(0);
    expect(notaAutonomia(30 * 60_000)).toBeCloseTo(0.5, 10);
    expect(notaAutonomia(null)).toBeNull();
  });

  it('super efetivos: 15% em 2/3, 30% em 1/3', () => {
    expect(notaSuperEfetivos(0)).toBe(1);
    expect(notaSuperEfetivos(0.15)).toBeCloseTo(DOIS_TERCOS, 10);
    expect(notaSuperEfetivos(0.3)).toBeCloseTo(UM_TERCO, 10);
    expect(notaSuperEfetivos(0.6)).toBe(0);
  });

  it('contagem ruim: zero verde, um já vermelho e piora', () => {
    expect(notaContagem(0)).toBe(1);
    expect(notaContagem(1)).toBeLessThan(UM_TERCO);
    expect(notaContagem(3)).toBeLessThan(notaContagem(1));
  });

  it('golpes por abate: 3 em 2/3, 15 em 1/3', () => {
    expect(notaGolpes(3)).toBeCloseTo(DOIS_TERCOS, 10);
    expect(notaGolpes(15)).toBeCloseTo(UM_TERCO, 10);
    expect(notaGolpes(1)).toBeGreaterThan(DOIS_TERCOS);
    expect(notaGolpes(500)).toBe(0);
  });

  it('resistência: 5 abates em 2/3, 1 em 1/3', () => {
    expect(notaResistencia(50, 10)).toBeCloseTo(DOIS_TERCOS, 10);
    expect(notaResistencia(10, 10)).toBeCloseTo(UM_TERCO, 10);
    expect(notaResistencia(1000, 10)).toBe(1);
    expect(notaResistencia(null, 10)).toBeNull();
  });

  it('percentil na lista', () => {
    const todos = [10, 20, 30, 40];
    expect(notaPercentil(40, todos)).toBe(1);
    expect(notaPercentil(10, todos)).toBe(0);
    expect(notaPercentil(25, todos)).toBeCloseTo(0.5, 10);
    expect(notaPercentil(5, [5])).toBe(0.5);
  });

  it('vs melhor: 100% verde cheio, 90% em 2/3, 50% em 1/3', () => {
    expect(notaVsMelhor(100, 100)).toBe(1);
    expect(notaVsMelhor(90, 100)).toBeCloseTo(DOIS_TERCOS, 10);
    expect(notaVsMelhor(50, 100)).toBeCloseTo(UM_TERCO, 10);
    expect(notaVsMelhor(0, 100)).toBe(0);
    expect(notaVsMelhor(10, 0)).toBe(0.5);
  });

  it('estado geral do botão', () => {
    expect(notaGeral({ lucroRealH: 100, autonomiaMs: null, desmaios: 0, perigo: false })).toBe(1);
    expect(notaGeral({ lucroRealH: -1, autonomiaMs: null, desmaios: 0, perigo: false })).toBe(0);
    expect(notaGeral({ lucroRealH: 100, autonomiaMs: 60_000, desmaios: 0, perigo: false })).toBe(0);
    expect(notaGeral({ lucroRealH: 100, autonomiaMs: null, desmaios: 1, perigo: false })).toBe(0);
    expect(notaGeral(null)).toBe(0.5);
  });
});

describe('notaDinamica: hunt atual contra as outras hunts e o histórico', () => {
  const outras = [100, 200, 300, 400, 500, 600];

  it('a posição entre as hunts possíveis é a nota base', () => {
    expect(notaDinamica(650, outras, null)).toMatchObject({ nota: 1, percentil: 1 });
    expect(notaDinamica(350, outras, null)).toMatchObject({ nota: 0.5, percentil: 0.5 });
    expect(notaDinamica(50, outras, null)).toMatchObject({ nota: 0, percentil: 0 });
  });

  it('o histórico desloca a nota até um terço, proporcional à diferença', () => {
    expect(notaDinamica(350, outras, 350 / 1.1).nota).toBeCloseTo(0.5 + UM_TERCO, 6);
    expect(notaDinamica(350, outras, 350 / 1.05).nota).toBeCloseTo(0.5 + UM_TERCO / 2, 6);
    expect(notaDinamica(350, outras, 350 / 0.5).nota).toBeCloseTo(0.5 - UM_TERCO, 6);
    expect(notaDinamica(650, outras, 100).nota).toBe(1);
  });

  it('sem outras hunts parte de 0,5; valor negativo é 0', () => {
    expect(notaDinamica(110, [], 100).nota).toBeCloseTo(0.5 + UM_TERCO, 6);
    expect(notaDinamica(100, [], null)).toMatchObject({
      nota: 0.5,
      percentil: null,
      vsHistorico: null,
    });
    expect(notaDinamica(-5, [-100, -50], null).nota).toBe(0);
  });
});
