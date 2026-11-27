import { describe, expect, it } from 'vitest';
import { atacanteDe } from '../../src/analysis/atacante';
import { IV_MEDIO } from '../../src/analysis/combate';
import { catalogos } from '../helpers/catalogos';

const { especies } = catalogos();

describe('atacanteDe', () => {
  it('monta o atacante com IVs, qualidade, potência, shiny, refino e TMs', () => {
    const a = atacanteDe(
      {
        id: 1,
        speciesId: 4,
        level: 30,
        ivs: { hp: 10, atk: 20, def: 5, spAtk: 32, spDef: 1, speed: 15 },
        quality: 1.3,
        potencia: 4,
        shiny: true,
        refino: { atk: 5, speed: 9 },
        maxHp: 900,
        tmElemental: 'WATER',
        tmFisico: true,
        tmAoe: true,
      },
      especies,
    )!;
    expect(a).toMatchObject({
      nivel: 30,
      qualidade: 1.3,
      mult: 1.25 * 3,
      hpCombate: 900,
      tmElemental: 'WATER',
      tmFisico: true,
      tmAoe: true,
    });
    expect(a.especie.bases).toMatchObject({ atk: 52 + 5, speed: 65 });
    expect(a.statsProntos).toBeUndefined();
  });

  it('usa stats do servidor só quando vêm completos e IV médio quando faltam IVs', () => {
    const completo = atacanteDe(
      {
        id: 1,
        speciesId: 4,
        level: 5,
        stats: { hp: 1, atk: 2, def: 3, spAtk: 4, spDef: 5, speed: 6 },
      },
      especies,
    )!;
    expect(completo.statsProntos).toEqual({ hp: 1, atk: 2, def: 3, spAtk: 4, spDef: 5, speed: 6 });
    expect(completo.ivs).toBe(IV_MEDIO);
    expect(completo.qualidade).toBe(1);
    const parcial = atacanteDe({ id: 1, speciesId: 4, level: 5, stats: { atk: 2 } }, especies)!;
    expect(parcial.statsProntos).toBeUndefined();
  });

  it('sem espécie conhecida ou sem stats base não monta', () => {
    expect(atacanteDe({ id: 1, speciesId: 999, level: 5 }, especies)).toBeNull();
    expect(atacanteDe({ id: 1, level: 5 }, especies)).toBeNull();
  });
});
