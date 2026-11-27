import { describe, expect, it } from 'vitest';
import {
  cooldownComSpeed,
  cooldownDoPoder,
  descontoDoSpeedPct,
  intervaloGlobalMs,
  recargaInvestidaMs,
} from '../../src/domain/cadencia';
import {
  QUALIDADE_MEDIA_SELVAGEM,
  danoMedio,
  efetividadeNaHunt,
  hpDeCombate,
  multDeNascenca,
  statsNoNivel,
} from '../../src/analysis/combate';

const bases = { hp: 78, atk: 84, def: 78, spAtk: 109, spDef: 85, speed: 100 };
const ivs = { hp: 32, atk: 32, def: 32, spAtk: 32, spDef: 32, speed: 32 };

describe('cadência (cooldown-golpes.mjs)', () => {
  it('recarga pelo poder: 15 → 10 s, 100 → 30 s, 600 → 60 s', () => {
    expect(cooldownDoPoder(15)).toBe(10_000);
    expect(cooldownDoPoder(5)).toBe(10_000);
    expect(cooldownDoPoder(100)).toBe(30_000);
    expect(cooldownDoPoder(600)).toBe(60_000);
    expect(cooldownDoPoder(50)).toBe(18_200);
  });

  it('desconto por speed com teto de 7% e IV', () => {
    expect(descontoDoSpeedPct(100, 32)).toBeCloseTo(5, 10);
    expect(descontoDoSpeedPct(200, 32)).toBe(7);
    expect(descontoDoSpeedPct(100, 16)).toBeCloseTo(2.5, 10);
    expect(cooldownComSpeed(60_000, 100, 32)).toBe(57_000);
    expect(cooldownComSpeed(0, 100, 32)).toBe(0);
  });

  it('intervalo global e Investida caem 10 ms por IV de speed, com piso', () => {
    expect(intervaloGlobalMs(32)).toBe(580);
    expect(intervaloGlobalMs(undefined)).toBe(890);
    expect(recargaInvestidaMs(32)).toBe(1680);
  });
});

describe('combate (ginasios.mjs / pokepedia)', () => {
  it('stats no nível pela fórmula do jogo', () => {
    const s = statsNoNivel(bases, ivs, 100, 1, 1);
    expect(s).toEqual({ hp: 142, atk: 148, def: 142, spAtk: 173, spDef: 149, speed: 164 });
    const q = statsNoNivel(bases, ivs, 50, 1.5, 1.1);
    expect(q.atk).toBe(Math.round((84 + 64) * 0.5 * 1.5 ** 0.8 * 1.1));
    expect(q.hp).toBe(Math.round((78 + 64) * 0.5 * 1.5 ** 0.95 * 1.1));
  });

  it('multiplicador de nascença: potência, shiny', () => {
    expect(multDeNascenca(1, false)).toBe(1);
    expect(multDeNascenca(4, false)).toBe(1.25);
    expect(multDeNascenca(5, true)).toBe(6);
    expect(multDeNascenca(undefined, false)).toBe(1);
  });

  it('HP de combate ×12 com piso 24', () => {
    expect(hpDeCombate(10)).toBe(120);
    expect(hpDeCombate(1)).toBe(24);
  });

  it('efetividade ampliada na hunt: 2 → 2,5; 4 → 5,5; 0,5 → 1/3', () => {
    expect(efetividadeNaHunt(2, 1.5)).toBe(2.5);
    expect(efetividadeNaHunt(4, 1.5)).toBe(5.5);
    expect(efetividadeNaHunt(0.5, 1.5)).toBeCloseTo(1 / 3, 10);
    expect(efetividadeNaHunt(0, 1.5)).toBe(0);
    expect(efetividadeNaHunt(1, 1.5)).toBe(1);
  });

  it('dano médio pela fórmula com aleatório médio 0,925', () => {
    const d = danoMedio({ nivel: 50, poder: 100, atk: 100, def: 100, stab: true, ef: 1 });
    expect(d).toBeCloseTo(((((2 * 50) / 5 + 2) * 100 * 1) / 50 + 2) * 1.5 * 0.925, 6);
    expect(
      danoMedio({ nivel: 50, poder: 100, atk: 100, def: 0, stab: false, ef: 2.5 }),
    ).toBeGreaterThan(0);
  });

  it('qualidade média dos selvagens pela distribuição do jogo', () => {
    expect(QUALIDADE_MEDIA_SELVAGEM).toBeCloseTo(1.177, 2);
  });
});
