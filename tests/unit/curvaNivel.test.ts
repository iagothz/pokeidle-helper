import { describe, expect, it } from 'vitest';
import {
  AMOSTRA_MINIMA_NIVEIS,
  ajustarCurvaNivel,
  etaPelaCurva,
  projetarProgressao,
  resumirCurva,
  trechosDaHunt,
} from '../../src/analysis/curvaNivel';
import { FAIXA_NEUTRA } from '../../src/analysis/multiplicadores';
import { xpDoNivelSeguinte, xpTotalDoNivel } from '../../src/analysis/progressao';
import type { Trecho } from '../../src/domain/coletaDetalhada';
import { novaSessao } from '../../src/domain/sessao';

const golpesReais = (lv: number) => 1 + Math.exp(3.6 - 0.015 * lv);
const cicloReal = (g: number) => 2.9 + 0.65 * g;

function trecho(lv: number, extra: Partial<Trecho> = {}): Trecho {
  const abates = 100;
  const g = golpesReais(lv);
  const ciclo = cicloReal(g);
  return {
    inicio: lv * 1_000_000,
    fim: lv * 1_000_000 + 1,
    pokemonId: '9',
    level: lv,
    tipoSazonal: 'FIRE',
    msAtivo: Math.round(ciclo * abates * 1000),
    abates,
    golpesDados: Math.round(g * abates),
    danoCausado: 0,
    xpPokemon: 43_520 * abates,
    gold: 1_024 * abates,
    desmaios: 0,
    fases: { lutaMs: 0, deslocamentoMs: 0, esperaMs: 0, ondas: 0 },
    ...extra,
  };
}

const faixa = (de: number, ate: number) =>
  Array.from({ length: ate - de + 1 }, (_, i) => trecho(de + i));

describe('ajustarCurvaNivel', () => {
  it('recupera a queda exponencial de golpes e o ciclo em função dos golpes', () => {
    const c = ajustarCurvaNivel(faixa(215, 310))!;
    expect(c.golpes.b).toBeCloseTo(-0.015, 3);
    expect(c.golpes.a).toBeCloseTo(3.6, 1);
    expect(c.ciclo.a).toBeCloseTo(2.9, 1);
    expect(c.ciclo.b).toBeCloseTo(0.65, 1);
    expect(c.golpes.r2).toBeGreaterThan(0.95);
    expect(c.amostra).toEqual({ niveis: 96, abates: 9_600, nivelMin: 215, nivelMax: 310 });
    expect(c.xpPorAbate).toBe(43_520);
    expect(c.ouroPorAbate).toBe(1_024);
  });

  it('usa XP e ouro por abate do trecho mais recente', () => {
    const trechos = [
      ...faixa(215, 222).map((t) => ({ ...t, xpPokemon: 29_013 * t.abates })),
      ...faixa(223, 230),
    ];
    expect(ajustarCurvaNivel(trechos)?.xpPorAbate).toBe(43_520);
  });

  it('ignora trechos sem nível ou com poucos abates e exige amostra mínima', () => {
    const poucos = faixa(215, 215 + AMOSTRA_MINIMA_NIVEIS - 2);
    expect(ajustarCurvaNivel(poucos)).toBeNull();
    const ruido = [
      trecho(400, { abates: 3 }),
      trecho(401, { level: undefined } as Partial<Trecho>),
    ];
    expect(ajustarCurvaNivel([...poucos, ...ruido])).toBeNull();
  });

  it('agrupa trechos do mesmo nível antes de ajustar', () => {
    const metade = (lv: number) =>
      trecho(lv, { abates: 50, golpesDados: Math.round(golpesReais(lv) * 50) });
    const c = ajustarCurvaNivel(
      faixa(215, 225).flatMap((t) => [metade(t.level!), metade(t.level!)]),
    );
    expect(c?.amostra.niveis).toBe(11);
  });

  it('sem melhora com o nível, mantém golpes e ciclo constantes', () => {
    const planos = faixa(215, 225).map((t) => ({ ...t, golpesDados: 200, msAtivo: 400_000 }));
    const c = ajustarCurvaNivel(planos)!;
    expect(c.golpes.b).toBe(0);
    expect(c.ciclo.b).toBe(0);
    expect(c.ciclo.a).toBeCloseTo(4, 5);
  });
});

describe('projetarProgressao', () => {
  const curva = ajustarCurvaNivel(faixa(215, 310))!;

  it('projeta golpes, ritmo e tempo acumulado até os próximos níveis', () => {
    const p = projetarProgressao(curva, { nivel: 310, xp: xpTotalDoNivel(310) }, null);
    expect(p.atual.level).toBe(310);
    expect(p.atual.golpesPorAbate).toBeCloseTo(golpesReais(310), 2);
    const abatesH = 3600 / cicloReal(golpesReais(310));
    expect(p.atual.abatesH).toBeCloseTo(abatesH, 0);
    expect(p.atual.xpH / (abatesH * 43_520)).toBeCloseTo(1, 3);
    const prox = p.linhas[0]!;
    expect(prox.level).toBe(311);
    expect(prox.msAte! / ((xpDoNivelSeguinte(310) / p.atual.xpH) * 3_600_000)).toBeCloseTo(1, 6);
    expect(p.linhas.map((l) => l.level)).toEqual([311, 315, 320, 330, 360, 410]);
    for (let i = 1; i < p.linhas.length; i++)
      expect(p.linhas[i]!.msAte!).toBeGreaterThan(p.linhas[i - 1]!.msAte!);
  });

  it('calcula o teto com um golpe por abate e a fração já atingida', () => {
    const p = projetarProgressao(curva, { nivel: 310, xp: xpTotalDoNivel(310) }, null);
    const teto = 3600 / cicloReal(1);
    expect(p.teto.abatesH).toBeCloseTo(teto, 0);
    expect(p.teto.goldH / (teto * 1_024)).toBeCloseTo(1, 3);
    expect(p.fracaoTeto).toBeCloseTo(p.atual.abatesH / p.teto.abatesH, 5);
  });

  it('desconta o XP já ganho no nível atual', () => {
    const meio = xpTotalDoNivel(310) + xpDoNivelSeguinte(310) / 2;
    const cheio = projetarProgressao(curva, { nivel: 310, xp: xpTotalDoNivel(310) }, null);
    const metade = projetarProgressao(curva, { nivel: 310, xp: meio }, null);
    expect(metade.linhas[0]!.msAte! / cheio.linhas[0]!.msAte!).toBeCloseTo(0.5, 6);
  });

  it('para no limite de nível do treinador + 5', () => {
    const p = projetarProgressao(curva, { nivel: 310, xp: undefined }, 318);
    expect(p.limiteNivel).toBe(318);
    expect(p.linhas.map((l) => l.level)).toEqual([311, 315, 318]);
  });

  it('com bônus que vence, o tempo de cada nível conta o fim do bônus', () => {
    const sem = projetarProgressao(curva, { nivel: 310, xp: xpTotalDoNivel(310) }, null);
    const comBoost = projetarProgressao(curva, { nivel: 310, xp: xpTotalDoNivel(310) }, null, {
      xpBasePorAbate: 43_520,
      faixas: [
        { horas: 1, xpTreinador: 2, xpPokemon: 2 },
        { horas: Infinity, xpTreinador: 1, xpPokemon: 1 },
      ],
    });
    const ultimaSem = sem.linhas.at(-1)!.msAte!;
    const ultimaCom = comBoost.linhas.at(-1)!.msAte!;
    expect((ultimaSem - ultimaCom) / 3_600_000).toBeCloseTo(1, 6);
    expect(comBoost.linhas[0]!.msAte!).toBeCloseTo(sem.linhas[0]!.msAte! / 2, 0);
  });

  it('no limite, não projeta níveis', () => {
    const p = projetarProgressao(curva, { nivel: 318, xp: undefined }, 318);
    expect(p.linhas).toEqual([]);
  });
});

describe('etaPelaCurva', () => {
  const curva = ajustarCurvaNivel(faixa(215, 310))!;
  const plana = ajustarCurvaNivel(
    faixa(215, 225).map((t) => ({ ...t, golpesDados: 200, msAtivo: 400_000 })),
  )!;
  const xpHPlana = (3600 / 4) * 43_520;

  it('com curva plana e sem trava equivale ao ritmo constante', () => {
    const r = etaPelaCurva(plana, {
      quem: 'pokemon',
      alvo: 312,
      treinador: { nivel: 400, xp: xpTotalDoNivel(400) },
      pokemon: { nivel: 310, xp: xpTotalDoNivel(310) },
      xpBasePorAbate: 43_520,
      faixas: [FAIXA_NEUTRA],
    });
    const faltam = xpTotalDoNivel(312) - xpTotalDoNivel(310);
    expect(r.msAte! / ((faltam / xpHPlana) * 3_600_000)).toBeCloseTo(1, 6);
    expect(r.faltam).toBe(faltam);
  });

  it('com a curva subindo chega antes do que no ritmo de agora', () => {
    const estado = {
      treinador: { nivel: 330, xp: xpTotalDoNivel(330) },
      pokemon: { nivel: 310, xp: xpTotalDoNivel(310) },
      xpBasePorAbate: 43_520,
      faixas: [FAIXA_NEUTRA],
    };
    const r = etaPelaCurva(curva, { ...estado, quem: 'pokemon', alvo: 335 });
    const agora = projetarProgressao(curva, { nivel: 310, xp: undefined }, null).atual.xpH;
    const constante = ((xpTotalDoNivel(335) - xpTotalDoNivel(310)) / agora) * 3_600_000;
    expect(r.msAte!).toBeLessThan(constante);
  });

  it('o pokémon travado em treinador + 5 espera o treinador subir', () => {
    const r = etaPelaCurva(plana, {
      quem: 'pokemon',
      alvo: 317,
      treinador: { nivel: 310, xp: xpTotalDoNivel(310) },
      pokemon: { nivel: 315, xp: xpTotalDoNivel(315) },
      xpBasePorAbate: 43_520,
      faixas: [FAIXA_NEUTRA],
    });
    const treinadorAte312 = ((xpTotalDoNivel(312) - xpTotalDoNivel(310)) / xpHPlana) * 3_600_000;
    expect(r.msAte!).toBeGreaterThanOrEqual(treinadorAte312 - 1);
  });

  it('meta do treinador usa o XP do treinador e a razão de XP', () => {
    const base = {
      quem: 'treinador' as const,
      alvo: 322,
      treinador: { nivel: 320, xp: xpTotalDoNivel(320) },
      pokemon: { nivel: 320, xp: xpTotalDoNivel(320) },
    };
    const comBonus = (xpTreinador: number, xpPokemon: number) =>
      etaPelaCurva(plana, {
        ...base,
        xpBasePorAbate: 43_520,
        faixas: [{ horas: Infinity, xpTreinador, xpPokemon }],
      });
    expect(comBonus(2, 1).msAte! / comBonus(1, 1).msAte!).toBeCloseTo(0.5, 6);
    expect(comBonus(1, 3).msAte! / comBonus(1, 1).msAte!).toBeCloseTo(1, 6);
  });

  it('o boost que vence no meio do caminho fica entre com e sem boost', () => {
    const base = {
      quem: 'pokemon' as const,
      alvo: 345,
      treinador: { nivel: 400, xp: xpTotalDoNivel(400) },
      pokemon: { nivel: 320, xp: xpTotalDoNivel(320) },
      xpBasePorAbate: 43_520,
    };
    const sem = etaPelaCurva(plana, { ...base, faixas: [FAIXA_NEUTRA] }).msAte!;
    const sempre = etaPelaCurva(plana, {
      ...base,
      faixas: [{ horas: Infinity, xpTreinador: 2, xpPokemon: 2 }],
    }).msAte!;
    const umaHora = etaPelaCurva(plana, {
      ...base,
      faixas: [
        { horas: 1, xpTreinador: 2, xpPokemon: 2 },
        { horas: Infinity, xpTreinador: 1, xpPokemon: 1 },
      ],
    }).msAte!;
    expect(sempre).toBeCloseTo(sem / 2, -1);
    expect(umaHora).toBeGreaterThan(sempre);
    expect(umaHora).toBeLessThan(sem);
    expect((sem - umaHora) / 3_600_000).toBeCloseTo(1, 6);
  });

  it('usa o XP base, não o XP medido com o bônus da época', () => {
    const r = etaPelaCurva(plana, {
      quem: 'pokemon',
      alvo: 312,
      treinador: { nivel: 400, xp: xpTotalDoNivel(400) },
      pokemon: { nivel: 310, xp: xpTotalDoNivel(310) },
      xpBasePorAbate: 43_520 / 2,
      faixas: [FAIXA_NEUTRA],
    });
    const faltam = xpTotalDoNivel(312) - xpTotalDoNivel(310);
    expect(r.msAte! / ((faltam / (xpHPlana / 2)) * 3_600_000)).toBeCloseTo(1, 6);
  });

  it('alvo já alcançado dá zero', () => {
    const r = etaPelaCurva(plana, {
      quem: 'treinador',
      alvo: 300,
      treinador: { nivel: 320, xp: xpTotalDoNivel(320) },
      pokemon: { nivel: 320, xp: undefined },
      xpBasePorAbate: 43_520,
      faixas: [FAIXA_NEUTRA],
    });
    expect(r).toEqual({ faltam: 0, msAte: 0 });
  });
});

describe('resumirCurva', () => {
  it('resume o ajuste para o log com coeficientes e teto arredondados', () => {
    const r = resumirCurva(ajustarCurvaNivel(faixa(215, 310))!);
    expect(r).toMatchObject({
      niveis: 96,
      nivelMin: 215,
      nivelMax: 310,
      golpesB: expect.closeTo(-0.015, 3),
      cicloA: expect.closeTo(2.9, 1),
      cicloB: expect.closeTo(0.65, 1),
      tetoAbatesH: Math.round(3600 / cicloReal(1)),
    });
    expect(resumirCurva(null)).toBeNull();
  });
});

describe('trechosDaHunt', () => {
  it('junta trechos do pokémon e do dia sazonal na hunt, sem repetir a sessão ao vivo', () => {
    const s1 = {
      ...novaSessao('sunkern', 'Sunkern', 0),
      id: 'a',
      trechos: [trecho(215), trecho(216, { pokemonId: '7' })],
    };
    const s2 = {
      ...novaSessao('sunkern', 'Sunkern', 0),
      id: 'b',
      trechos: [trecho(217, { tipoSazonal: 'WATER' })],
    };
    const outra = { ...novaSessao('geodude', 'Geodude', 0), id: 'c', trechos: [trecho(218)] };
    const vivo = { ...s1, trechos: [trecho(215), trecho(219)] };
    const r = trechosDaHunt([s1, s2, outra], vivo, {
      huntSlug: 'sunkern',
      pokemonId: '9',
      tipoSazonal: 'FIRE',
    });
    expect(r.map((t) => t.level)).toEqual([215, 219]);
  });
});
