import { describe, expect, it } from 'vitest';
import { lerGolpesDasPlanilhas } from '../../src/domain/golpesPlanilhas';

const TEXTO = `
import { cooldownDoPoder } from './cooldown-golpes.mjs';
export const GOLPES_A = {};
export const GOLPES_B = {
  69: [
    ['Vine Whip',   'GRASS',  'PHYSICAL', 45],
    ["Land's Wrath", 'GROUND', 'PHYSICAL', 600],
  ],
  74: [
    ['Rock Throw', 'ROCK', 'PHYSICAL', 50],
  ],
};
const MEGA = 'MEGA';
export const GOLPES_C = {
  69: [
    ['Leaf Storm', 'GRASS', 'SPECIAL', 130],
    ['Mega Bloom', 'GRASS', 'SPECIAL', 900, MEGA],
  ],
};
export const GOLPES_FORA = {
  1: [['Ignorado', 'NORMAL', 'PHYSICAL', 10]],
};
const TABELAS = [
  GOLPES_A,
  GOLPES_B,
  GOLPES_C,
];
const TABELAS_FECHADAS = new Set([
  GOLPES_B,
]);
`;

describe('lerGolpesDasPlanilhas', () => {
  it('aplica as tabelas na ordem de TABELAS, a última vence por espécie', () => {
    const { golpes: r, fechadas } = lerGolpesDasPlanilhas(TEXTO);
    expect([...fechadas]).toEqual([74]);
    expect([...r.keys()].sort()).toEqual([69, 74]);
    expect(r.get(74)).toEqual([
      {
        nome: 'Rock Throw',
        tipo: 'ROCK',
        categoria: 'PHYSICAL',
        poder: 50,
        cooldownMs: 18200,
        nivelAprende: 1,
      },
    ]);
    expect(r.get(69)?.map((g) => g.nome)).toEqual(['Leaf Storm', 'Mega Bloom']);
    expect(r.get(69)?.[1]).toMatchObject({ poder: 900, cooldownMs: 30000 });
  });

  it('calcula a recarga pelo poder como o jogo', () => {
    const { golpes: r } = lerGolpesDasPlanilhas(
      TEXTO.replace("'Rock Throw', 'ROCK', 'PHYSICAL', 50", "'X', 'ROCK', 'PHYSICAL', 600"),
    );
    expect(r.get(74)?.[0]?.cooldownMs).toBe(60000);
  });

  it('texto sem TABELAS ou inválido devolve mapa vazio', () => {
    expect(lerGolpesDasPlanilhas('lixo').golpes.size).toBe(0);
    expect(lerGolpesDasPlanilhas('').fechadas.size).toBe(0);
  });
});
