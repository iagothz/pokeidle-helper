import { describe, expect, it } from 'vitest';
import { FAIXA_NEUTRA } from '../../src/analysis/multiplicadores';
import {
  FOLGA_NIVEL_POKEMON,
  custoRefino,
  etaComBonus,
  etaParaNivel,
  horasParaGanhar,
  pokemonsTravados,
  progressoEvolucao,
  xpDoNivelSeguinte,
  xpTotalDoNivel,
} from '../../src/analysis/progressao';

const HORA = 3_600_000;
const constante = (xpHBase: number, quem: 'xpTreinador' | 'xpPokemon' = 'xpTreinador') => ({
  xpHBase,
  faixas: [FAIXA_NEUTRA],
  quem,
});
const boostDeUmaHora = [
  { horas: 1, xpTreinador: 3, xpPokemon: 2 },
  { horas: Infinity, xpTreinador: 1.5, xpPokemon: 1.5 },
];

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

describe('horasParaGanhar', () => {
  it('sem bônus é XP dividido pelo ritmo', () => {
    expect(horasParaGanhar(500, 100, [FAIXA_NEUTRA], 'xpPokemon')).toBe(5);
  });

  it('usa o bônus enquanto ele dura e o ritmo menor depois', () => {
    expect(horasParaGanhar(150, 100, boostDeUmaHora, 'xpTreinador')).toBeCloseTo(0.5, 10);
    expect(horasParaGanhar(450, 100, boostDeUmaHora, 'xpTreinador')).toBeCloseTo(2, 10);
    expect(horasParaGanhar(450, 100, boostDeUmaHora, 'xpPokemon')).toBeCloseTo(2.666666, 5);
  });

  it('começando depois do vencimento ignora o bônus', () => {
    expect(horasParaGanhar(150, 100, boostDeUmaHora, 'xpTreinador', 2)).toBeCloseTo(1, 10);
    expect(horasParaGanhar(450, 100, boostDeUmaHora, 'xpTreinador', 0.5)).toBeCloseTo(2.5, 10);
  });

  it('sem ritmo não chega', () => {
    expect(horasParaGanhar(1, 0, boostDeUmaHora, 'xpTreinador')).toBe(Infinity);
    expect(horasParaGanhar(0, 0, boostDeUmaHora, 'xpTreinador')).toBe(0);
  });
});

describe('etaComBonus', () => {
  it('desconta o fim do boost no tempo até o nível', () => {
    const faltam = xpTotalDoNivel(8) - 100;
    const xpHBase = faltam / 10;
    const r = etaComBonus(100, 8, { xpHBase, faixas: boostDeUmaHora, quem: 'xpTreinador' });
    expect(r.faltam).toBe(faltam);
    expect(r.msAte! / HORA).toBeCloseTo(1 + (faltam - 3 * xpHBase) / (1.5 * xpHBase), 10);
  });

  it('sem ritmo dá null e alvo alcançado dá zero', () => {
    expect(etaComBonus(0, 8, constante(0))).toEqual({ faltam: 4200, msAte: null });
    expect(etaComBonus(5000, 8, constante(10))).toEqual({ faltam: 0, msAte: 0 });
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
      constante(xpDoNivelSeguinte(10) + xpDoNivelSeguinte(11)),
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
    expect(pokemonsTravados([{ id: 1, level: 99 }], { level: undefined }, constante(10))).toEqual(
      [],
    );
  });
});

describe('progressoEvolucao', () => {
  it('XP, abates e tempo até o nível de evolução', () => {
    const r = progressoEvolucao(
      { level: 30, xp: xpTotalDoNivel(30) },
      { evolveLevel: 40, evolvesToId: 5 },
      100,
      constante(1000, 'xpPokemon'),
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
      progressoEvolucao({ level: 30, xp: 1 }, { evolveLevel: 0, evolvesToId: 0 }, 1, constante(1)),
    ).toBeNull();
    expect(
      progressoEvolucao({ level: 50, xp: 1 }, { evolveLevel: 40, evolvesToId: 5 }, 1, constante(1)),
    ).toBeNull();
    expect(
      progressoEvolucao({ level: 30 }, { evolveLevel: 40, evolvesToId: 5 }, 1, constante(1)),
    ).toBeNull();
  });
});

describe('custoRefino', () => {
  it('próximo passo 500·(3n²+3n+1) e total investido 500·n³', () => {
    expect(custoRefino(0)).toEqual({ proximo: 500, investido: 0 });
    expect(custoRefino(2)).toEqual({ proximo: 500 * 19, investido: 4000 });
  });
});
