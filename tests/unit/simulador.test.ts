import { describe, expect, it } from 'vitest';
import { abatesPorHoraTeorico } from '../../src/analysis/formulasJogo';
import {
  PARAMETROS_COMBATE_PADRAO,
  alocarDps,
  simularHunt,
  type Atacante,
} from '../../src/analysis/simulador';
import type { Hunt, TabelaTipos } from '../../src/domain/schemas';
import welcome from '../fixtures/welcome.json';
import { catalogos } from '../helpers/catalogos';

const tabela = welcome.tabelaTipos as TabelaTipos;
const { especies } = catalogos();
const bellsprout: Hunt = {
  slug: 'bellsprout',
  nome: 'Bellsprout',
  nivel: 1,
  especies: [{ pokeId: 69, pontos: 3 }],
};
const geodude: Hunt = {
  slug: 'geodude',
  nome: 'Geodude',
  nivel: 10,
  especies: [{ pokeId: 74, pontos: 4 }],
};

function charmander(nivel: number, extra: Partial<Atacante> = {}): Atacante {
  return {
    especie: especies.obter(4)!,
    nivel,
    ivs: 32,
    qualidade: 1,
    mult: 1,
    ...extra,
  };
}

describe('alocarDps', () => {
  it('usa primeiro o golpe de maior dano, limitado pela recarga e pelo intervalo global', () => {
    const r = alocarDps(
      [
        { dano: 100, recargaMs: 10_000 },
        { dano: 10, recargaMs: 1_000 },
      ],
      1_000,
    );
    expect(r.acoesPorSeg).toBeCloseTo(1, 10);
    expect(r.dps).toBeCloseTo(100 * 0.1 + 10 * 0.9, 10);
  });

  it('sem golpes não causa dano', () => {
    expect(alocarDps([], 900)).toEqual({ dps: 0, acoesPorSeg: 0 });
  });
});

describe('simularHunt', () => {
  it('um abate por golpe: luta de uma ação + deslocamento e onda do modelo do jogo', () => {
    const r = simularHunt(
      charmander(100, { ivs: 1 }),
      bellsprout,
      especies,
      tabela,
      PARAMETROS_COMBATE_PADRAO,
    )!;
    const e = r.porEspecie[0]!;
    expect(e.acoesPorAbate).toBe(1);
    expect(e.tAbateS).toBeCloseTo(e.tLutaS + 2.6 + 2.6 / 3, 10);
    expect(r.abatesH).toBeLessThanOrEqual(abatesPorHoraTeorico(bellsprout) * 1.01);
  });

  it('pokémon mais fraco ou hunt mais forte rende menos abates por hora', () => {
    const forte = simularHunt(
      charmander(20),
      geodude,
      especies,
      tabela,
      PARAMETROS_COMBATE_PADRAO,
    )!;
    const fraco = simularHunt(charmander(5), geodude, especies, tabela, PARAMETROS_COMBATE_PADRAO)!;
    expect(fraco.abatesH).toBeLessThan(forte.abatesH);
    expect(fraco.porEspecie[0]!.acoesPorAbate).toBeGreaterThan(forte.porEspecie[0]!.acoesPorAbate);
    const facil = simularHunt(
      charmander(5),
      bellsprout,
      especies,
      tabela,
      PARAMETROS_COMBATE_PADRAO,
    )!;
    expect(facil.abatesH).toBeGreaterThan(fraco.abatesH);
  });

  it('vantagem de tipo encurta a luta', () => {
    const squirtle: Atacante = { ...charmander(8), especie: especies.obter(7)! };
    const fogo = simularHunt(charmander(8), geodude, especies, tabela, PARAMETROS_COMBATE_PADRAO)!;
    const agua = simularHunt(squirtle, geodude, especies, tabela, PARAMETROS_COMBATE_PADRAO)!;
    expect(agua.porEspecie[0]!.tLutaS).toBeLessThan(fogo.porEspecie[0]!.tLutaS);
  });

  it('TM de área divide a luta pelos alvos atingidos e o Z-Move soma dano', () => {
    const base = simularHunt(charmander(5), geodude, especies, tabela, PARAMETROS_COMBATE_PADRAO)!;
    const aoe = simularHunt(
      charmander(5, { tmAoe: true }),
      geodude,
      especies,
      tabela,
      PARAMETROS_COMBATE_PADRAO,
    )!;
    const z = simularHunt(
      charmander(5, { tmElemental: 'WATER' }),
      geodude,
      especies,
      tabela,
      PARAMETROS_COMBATE_PADRAO,
    )!;
    expect(aoe.abatesH).toBeGreaterThan(base.abatesH);
    expect(z.porEspecie[0]!.dps).toBeGreaterThan(base.porEspecie[0]!.dps);
  });

  it('dia sazonal: seu pokémon do tipo bate ×2; selvagem do tipo apanha ÷4 sem escudo', () => {
    const base = simularHunt(charmander(5), geodude, especies, tabela, PARAMETROS_COMBATE_PADRAO)!;
    const fogo = simularHunt(charmander(5), geodude, especies, tabela, {
      ...PARAMETROS_COMBATE_PADRAO,
      tipoSazonal: 'FIRE',
    })!;
    expect(fogo.porEspecie[0]!.dps).toBeCloseTo(base.porEspecie[0]!.dps * 2, 6);
    expect(fogo.porEspecie[0]!.danoRecebidoPorSeg).toBeCloseTo(
      base.porEspecie[0]!.danoRecebidoPorSeg / 4,
      6,
    );
    const pedra = simularHunt(charmander(5), geodude, especies, tabela, {
      ...PARAMETROS_COMBATE_PADRAO,
      tipoSazonal: 'ROCK',
    })!;
    expect(pedra.porEspecie[0]!.dps).toBeCloseTo(base.porEspecie[0]!.dps / 4, 6);
    expect(pedra.porEspecie[0]!.danoRecebidoPorSeg).toBeCloseTo(
      base.porEspecie[0]!.danoRecebidoPorSeg * 2,
      6,
    );
    const comEscudo = simularHunt(charmander(5), geodude, especies, tabela, {
      ...PARAMETROS_COMBATE_PADRAO,
      tipoSazonal: 'ROCK',
      escudoSazonal: true,
    })!;
    expect(comEscudo.porEspecie[0]!.dps).toBeCloseTo(base.porEspecie[0]!.dps, 6);
  });

  it('usa deslocamento e espera de onda medidos quando informados', () => {
    const r = simularHunt(charmander(100, { ivs: 1 }), bellsprout, especies, tabela, {
      ...PARAMETROS_COMBATE_PADRAO,
      deslocamentoPorAbateS: 1,
      esperaPorOndaS: 3,
    })!;
    const e = r.porEspecie[0]!;
    expect(e.tAbateS).toBeCloseTo(e.tLutaS + 1 + 3 / 3, 10);
  });

  it('usa os stats prontos do servidor quando existem', () => {
    const r1 = simularHunt(charmander(5), geodude, especies, tabela, PARAMETROS_COMBATE_PADRAO)!;
    const r2 = simularHunt(
      charmander(5, {
        statsProntos: { hp: 999, atk: 999, def: 999, spAtk: 999, spDef: 999, speed: 999 },
      }),
      geodude,
      especies,
      tabela,
      PARAMETROS_COMBATE_PADRAO,
    )!;
    expect(r2.porEspecie[0]!.dps).toBeGreaterThan(r1.porEspecie[0]!.dps);
  });

  it('estima o dano recebido e o tempo para desmaiar contra um selvagem', () => {
    const r = simularHunt(charmander(5), geodude, especies, tabela, PARAMETROS_COMBATE_PADRAO)!;
    expect(r.porEspecie[0]!.danoRecebidoPorSeg).toBeGreaterThan(0);
    expect(r.segundosParaDesmaiar).toBeGreaterThan(0);
  });

  it('sem stats da espécie não simula', () => {
    const semBase: Atacante = { ...charmander(5), especie: { ...especies.obter(4)!, bases: null } };
    expect(simularHunt(semBase, geodude, especies, tabela, PARAMETROS_COMBATE_PADRAO)).toBeNull();
    expect(
      simularHunt(
        charmander(5),
        { ...geodude, especies: [{ pokeId: 999, pontos: 1 }] },
        especies,
        tabela,
        PARAMETROS_COMBATE_PADRAO,
      ),
    ).toBeNull();
  });
});
