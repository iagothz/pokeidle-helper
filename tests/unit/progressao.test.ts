import { describe, expect, it } from 'vitest';
import {
  FOLGA_NIVEL_POKEMON,
  custoRefino,
  etaParaNivel,
  pokemonsTravados,
  progressoEvolucao,
  xpDoNivelSeguinte,
  xpTotalDoNivel,
} from '../../src/analysis/progressao';

const HORA = 3_600_000;

describe('curva de XP (shared/boost-atrasados.mjs)', () => {
  it('XP total acumulado por nível e custo de um nível', () => {
    expect(xpTotalDoNivel(1)).toBe(0);
    expect(xpTotalDoNivel(2)).toBe(100);
    expect(xpTotalDoNivel(8)).toBe(4200);
    expect(xpDoNivelSeguinte(7)).toBe(xpTotalDoNivel(8) - xpTotalDoNivel(7));
    expect(xpDoNivelSeguinte(7)).toBe(50 * (49 - 21 + 4));
  });
});

describe('etaParaNivel', () => {
  it('XP e tempo até um nível-alvo no ritmo dado', () => {
    expect(etaParaNivel(100, 8, 4100)).toEqual({ faltam: 4100, msAte: HORA });
    expect(etaParaNivel(5000, 8, 100)).toEqual({ faltam: 0, msAte: 0 });
    expect(etaParaNivel(0, 8, 0)).toEqual({ faltam: 4200, msAte: null });
  });
});

describe('pokemonsTravados', () => {
  it('lista quem passa do nível do treinador + 5 e quanto falta para liberar', () => {
    const r = pokemonsTravados(
      [
        { id: 1, nome: 'Livre', level: 15 },
        { id: 2, nome: 'Travado', level: 20 },
        { id: 3, nome: 'Sem nível' },
      ],
      { level: 10, xp: xpTotalDoNivel(10) },
      xpDoNivelSeguinte(10) + xpDoNivelSeguinte(11),
    );
    expect(FOLGA_NIVEL_POKEMON).toBe(5);
    expect(r).toEqual([
      {
        pokemon: { id: 2, nome: 'Travado', level: 20 },
        nivelTreinadorNecessario: 15,
        faltamXp: xpTotalDoNivel(15) - xpTotalDoNivel(10),
        msAte:
          ((xpTotalDoNivel(15) - xpTotalDoNivel(10)) /
            (xpDoNivelSeguinte(10) + xpDoNivelSeguinte(11))) *
          HORA,
      },
    ]);
    expect(pokemonsTravados([{ id: 1, level: 99 }], { level: undefined }, 10)).toEqual([]);
  });
});

describe('progressoEvolucao', () => {
  it('XP, abates e tempo até o nível de evolução', () => {
    const r = progressoEvolucao(
      { level: 30, xp: xpTotalDoNivel(30) },
      { evolveLevel: 40, evolvesToId: 5 },
      100,
      1000,
    )!;
    expect(r).toEqual({
      nivelEvolucao: 40,
      faltamXp: xpTotalDoNivel(40) - xpTotalDoNivel(30),
      abates: Math.ceil((xpTotalDoNivel(40) - xpTotalDoNivel(30)) / 100),
      msAte: ((xpTotalDoNivel(40) - xpTotalDoNivel(30)) / 1000) * HORA,
    });
  });

  it('sem evolução, já evoluível ou sem XP conhecido não há progresso', () => {
    expect(
      progressoEvolucao({ level: 30, xp: 1 }, { evolveLevel: 0, evolvesToId: 0 }, 1, 1),
    ).toBeNull();
    expect(
      progressoEvolucao({ level: 50, xp: 1 }, { evolveLevel: 40, evolvesToId: 5 }, 1, 1),
    ).toBeNull();
    expect(progressoEvolucao({ level: 30 }, { evolveLevel: 40, evolvesToId: 5 }, 1, 1)).toBeNull();
  });
});

describe('custoRefino', () => {
  it('próximo passo 500·(3n²+3n+1) e total investido 500·n³', () => {
    expect(custoRefino(0)).toEqual({ proximo: 500, investido: 0 });
    expect(custoRefino(2)).toEqual({ proximo: 500 * 19, investido: 4000 });
  });
});
