import { describe, expect, it } from 'vitest';
import {
  MULTIPLICADORES_NEUTROS,
  VIP_MULT_XP,
  calcularMultiplicadores,
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
      { rotulo: 'VIP', mult: 1.5 },
      { rotulo: 'boost XP treinador', mult: 2 },
      { rotulo: 'boost XP pokémon', mult: 1.5 },
      { rotulo: 'boost loot', mult: 1.25 },
      { rotulo: 'guild', pct: 10 },
      { rotulo: 'boost da guild', mult: 1.1 },
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
