import { describe, expect, it } from 'vitest';
import {
  FAIXA_NEUTRA,
  MULTIPLICADORES_NEUTROS,
  VIP_MULT_XP,
  calcularMultiplicadores,
  faixaEm,
  faixasDeBonus,
} from '../../src/analysis/multiplicadores';

const AGORA = 1_000_000;
const tiposBoost = [
  { chave: 'xp', mult: 2 },
  { chave: 'pokexp', mult: 1.5 },
  { chave: 'loot', mult: 1.25 },
];

describe('calcularMultiplicadores', () => {
  it('sem bônus ativos devolve multiplicadores neutros', () => {
    expect(calcularMultiplicadores({ agora: AGORA, tiposBoost })).toEqual(MULTIPLICADORES_NEUTROS);
  });

  it('combina VIP, boosts da loja, bônus e boost da guild como o jogo', () => {
    const m = calcularMultiplicadores({
      agora: AGORA,
      tiposBoost,
      loja: { vipAte: AGORA + 1, boosts: { xp: AGORA + 1, pokexp: AGORA + 1, loot: AGORA + 1 } },
      guildBonusPct: 10,
      guildBoostAte: AGORA + 1,
      farmEventoPct: 5,
    });
    expect(m.xpTreinador).toBeCloseTo(2 * VIP_MULT_XP * 1.1 * 1.1, 10);
    expect(m.xpPokemon).toBeCloseTo(1.5 * VIP_MULT_XP * 1.1 * 1.1, 10);
    expect(m.bonusLootPct).toBeCloseTo(25 + 10 + 5, 10);
    expect(m.ativos).toEqual([
      { rotulo: 'VIP', mult: 1.5, ate: AGORA + 1 },
      { rotulo: 'boost XP treinador', mult: 2, ate: AGORA + 1 },
      { rotulo: 'boost XP pokémon', mult: 1.5, ate: AGORA + 1 },
      { rotulo: 'boost loot', mult: 1.25, ate: AGORA + 1 },
      { rotulo: 'guild', pct: 10 },
      { rotulo: 'boost da guild', mult: 1.1, ate: AGORA + 1 },
      { rotulo: 'evento de farm', pct: 5 },
    ]);
  });

  it('ignora bônus vencidos e boosts sem tipo conhecido', () => {
    const m = calcularMultiplicadores({
      agora: AGORA,
      tiposBoost: [],
      loja: { vipAte: AGORA, boosts: { xp: AGORA + 1 } },
      guildBoostAte: AGORA - 1,
    });
    expect(m).toEqual(MULTIPLICADORES_NEUTROS);
  });
});

const HORA = 3_600_000;

describe('faixasDeBonus', () => {
  it('sem bônus devolve uma faixa neutra sem fim', () => {
    expect(faixasDeBonus({ agora: AGORA, tiposBoost })).toEqual([
      { horas: Infinity, xpTreinador: 1, xpPokemon: 1 },
    ]);
  });

  it('corta a linha do tempo em cada vencimento, em ordem', () => {
    const faixas = faixasDeBonus({
      agora: AGORA,
      tiposBoost,
      loja: { vipAte: AGORA + 10 * HORA, boosts: { xp: AGORA + HORA, pokexp: AGORA + 2 * HORA } },
    });
    expect(faixas).toHaveLength(4);
    expect(faixas.map((f) => f.horas)).toEqual([1, 1, 8, Infinity]);
    expect(faixas[0]).toMatchObject({ xpTreinador: 2 * 1.5, xpPokemon: 1.5 * 1.5 });
    expect(faixas[1]).toMatchObject({ xpTreinador: 1.5, xpPokemon: 1.5 * 1.5 });
    expect(faixas[2]).toMatchObject({ xpTreinador: 1.5, xpPokemon: 1.5 });
    expect(faixas[3]).toMatchObject({ xpTreinador: 1, xpPokemon: 1 });
  });

  it('junta vencimentos iguais e ignora os já vencidos', () => {
    const faixas = faixasDeBonus({
      agora: AGORA,
      tiposBoost,
      loja: { vipAte: AGORA + HORA, boosts: { xp: AGORA + HORA, loot: AGORA - 1 } },
      guildBoostAte: AGORA - HORA,
    });
    expect(faixas.map((f) => f.horas)).toEqual([1, Infinity]);
  });
});

describe('faixaEm', () => {
  const faixas = [
    { horas: 1, xpTreinador: 3, xpPokemon: 2 },
    { horas: Infinity, xpTreinador: 1, xpPokemon: 1 },
  ];

  it('acha a faixa do instante e quanto falta para ela acabar', () => {
    expect(faixaEm(faixas, 0.25)).toEqual({ faixa: faixas[0], restante: 0.75 });
    expect(faixaEm(faixas, 1)).toEqual({ faixa: faixas[1], restante: Infinity });
    expect(faixaEm(faixas, 50)).toEqual({ faixa: faixas[1], restante: Infinity });
  });

  it('lista vazia vira neutra', () => {
    expect(faixaEm([], 3)).toEqual({ faixa: FAIXA_NEUTRA, restante: Infinity });
  });
});
