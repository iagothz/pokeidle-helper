import { describe, expect, it } from 'vitest';
import {
  abatesPorHoraTeorico,
  alvoRendaPorKill,
  mediaPorAbate,
  ouroPorAbate,
  ouroPorKillDoNivel,
  xpDoNivel,
} from '../../src/analysis/formulasJogo';
import { efetividade, melhorEfetividade } from '../../src/analysis/tipos';
import { agregar, custosDe, mediana, taxasDe } from '../../src/analysis/taxas';
import {
  avaliarHunt,
  classificar,
  melhorDoTime,
  pontuarParaHunt,
  tiposDoPokemon,
} from '../../src/analysis/dicasTipo';
import { montarRanking, ordenar } from '../../src/analysis/ranking';
import { novaSessao, type Sessao } from '../../src/domain/sessao';
import { CatalogoEspecies, CatalogoItens } from '../../src/domain/catalogo';
import welcome from '../fixtures/welcome.json';
import { catalogos } from '../helpers/catalogos';
import type { Hunt, TabelaTipos } from '../../src/domain/schemas';

const tabela = welcome.tabelaTipos as TabelaTipos;
const hunts = welcome.hunts.filter((h) => 'slug' in h) as unknown as Hunt[];
const bellsprout = hunts[0]!;
const geodude = hunts[2]!;
const charmander = welcome.estado.pokemons[0]!;
const squirtle = welcome.estado.pokemons[1]!;

describe('fórmulas do jogo', () => {
  it('reproduz os valores observados no nível 1 (8 XP, 41 de gold com 5 de loot)', () => {
    expect(xpDoNivel(1)).toBe(8);
    expect(ouroPorKillDoNivel(1)).toBe(36);
    expect(alvoRendaPorKill(1)).toBe(41);
    expect(ouroPorAbate(1)).toBe(41);
    expect(mediaPorAbate(bellsprout)).toEqual({ xp: 8, gold: 41 });
  });

  it('cobre faixas altas e bônus de loot', () => {
    expect(xpDoNivel(150)).toBe(13508);
    expect(xpDoNivel(300)).toBeGreaterThan(xpDoNivel(150));
    expect(ouroPorKillDoNivel(5000)).toBe(6000);
    expect(ouroPorKillDoNivel(10_000_000)).toBe(ouroPorKillDoNivel(25_000));
    expect(alvoRendaPorKill(50_000)).toBeGreaterThan(alvoRendaPorKill(25_000));
    expect(ouroPorAbate(1, 100)).toBe(46);
    expect(ouroPorKillDoNivel(0)).toBe(36);
  });

  it('estima abates por hora pela composição da hunt', () => {
    expect(abatesPorHoraTeorico(bellsprout)).toBeCloseTo(
      (3 / ((3 * 3500 + 2600) / 1000)) * 3600,
      6,
    );
    expect(abatesPorHoraTeorico({ ...bellsprout, especies: [] })).toBeGreaterThan(0);
    expect(
      abatesPorHoraTeorico({ ...bellsprout, especies: [{ pokeId: 1, pontos: 100 }] }),
    ).toBeCloseTo((16 / ((16 * 3500 + 2600) / 1000)) * 3600, 6);
  });
});

describe('tabela de tipos', () => {
  it('aplica a tabela do servidor, a diagonal e tipos duplos', () => {
    expect(efetividade('FIRE', ['GRASS', 'POISON'], tabela)).toBe(2);
    expect(efetividade('WATER', ['ROCK', 'GROUND'], tabela)).toBe(4);
    expect(efetividade('FIRE', ['FIRE'], tabela)).toBe(0.5);
    expect(efetividade('DRAGON', ['DRAGON'], {})).toBe(2);
    expect(efetividade('NORMAL', ['GHOST'], tabela)).toBe(0);
    expect(efetividade('fire', [], tabela)).toBe(1);
    expect(efetividade('FIRE', ['GRASS', 'GRASS'], tabela)).toBe(2);
    expect(melhorEfetividade(['NORMAL', 'FIRE'], ['GRASS', 'POISON'], tabela)).toBe(2);
    expect(melhorEfetividade([], ['GRASS'], tabela)).toBe(1);
  });
});

describe('taxas e custos', () => {
  const { precos } = catalogos();
  const s: Sessao = {
    ...novaSessao('bellsprout', 'Bellsprout', 0),
    msAtivo: 1_800_000,
    xpTreinador: 400,
    xpPokemon: 400,
    gold: 2050,
    abates: 50,
    bolas: { '1': 2 },
    pocoes: { '11': 3 },
    revives: { '12': 1 },
    drops: { '3': { nome: 'Seed', qtd: 5 }, 'nome:X': { nome: 'X', qtd: 1 } },
    vendasAuto: 500,
  };

  it('calcula taxas por hora, custo e lucro líquido', () => {
    const t = taxasDe(s, precos);
    expect(t.custos).toEqual({ bolas: 100, pocoes: 300, revives: 1000, total: 1400 });
    expect(t.xpPokemonH).toBe(800);
    expect(t.goldH).toBe(4100);
    expect(t.abatesH).toBe(100);
    expect(t.abatesMin).toBeCloseTo(100 / 60);
    expect(t.custoH).toBe(2800);
    expect(t.lucroLiquidoH).toBe(1300);
    expect(t.vendasAutoH).toBe(1000);
    expect(t.lucroRealH).toBe(2300);
    expect(t.custoPorAbate).toBe(28);
  });

  it('usa ritmo mínimo de 1 minuto e não divide por zero', () => {
    const t = taxasDe({ ...novaSessao('a', 'a', 0), gold: 10 }, precos);
    expect(t.goldH).toBe(600);
    expect(t.custoPorAbate).toBe(0);
    expect(
      custosDe({ bolas: { '9': 1 }, pocoes: {}, revives: {} }, { bola: () => NaN, item: () => 0 })
        .total,
    ).toBe(0);
  });

  it('agrega sessões somando contadores e drops', () => {
    const total = agregar([s, { ...s, id: 'b', drops: { '3': { qtd: 1 } } }]);
    expect(total).toMatchObject({
      sessoes: 2,
      msAtivo: 3_600_000,
      abates: 100,
      bolas: { '1': 4 },
      pocoes: { '11': 6 },
    });
    expect(total.drops['3']).toEqual({ nome: 'Seed', qtd: 6 });
    expect(agregar([{ ...s, drops: { '7': { qtd: 2 } } }]).drops['7']).toEqual({ qtd: 2 });
  });

  it('calcula mediana', () => {
    expect(mediana([])).toBeNull();
    expect(mediana([3, 1, 2])).toBe(2);
    expect(mediana([4, 1, 2, 3])).toBe(2.5);
  });
});

describe('dicas de tipo', () => {
  const { especies } = catalogos();

  it('lê tipos de ataque e defesa do pokémon', () => {
    expect(tiposDoPokemon(charmander, especies)).toEqual({
      ataque: ['FIRE', 'NORMAL'],
      defesa: ['FIRE'],
    });
    expect(tiposDoPokemon({ id: 9, tipos: ['ice'] }, especies)).toEqual({
      ataque: ['ICE'],
      defesa: ['ICE'],
    });
    expect(tiposDoPokemon({ id: 9 }, especies)).toBeNull();
    expect(tiposDoPokemon(undefined, especies)).toBeNull();
  });

  it('classifica vantagem, desvantagem e perigo', () => {
    const fogo = tiposDoPokemon(charmander, especies);
    expect(avaliarHunt(bellsprout, fogo, especies, tabela)).toMatchObject({
      ofensiva: 2,
      classificacao: 'vantagem',
      perigo: false,
    });
    const contraPedra = avaliarHunt(geodude, fogo, especies, tabela);
    expect(contraPedra.classificacao).toBe('desvantagem');
    expect(contraPedra.defensiva).toBe(2);
    expect(contraPedra.perigo).toBe(true);
    expect(avaliarHunt(geodude, null, especies, tabela)).toMatchObject({
      ofensiva: null,
      classificacao: 'desconhecido',
      especiesConhecidas: 0,
    });
    expect(classificar(1)).toBe('neutro');
  });

  it('pontua o pokémon pesando dano causado, dano recebido e nível', () => {
    const hunt = { ...geodude, nivel: 10 };
    const av = (ofensiva: number | null, defensiva: number | null) => ({
      ofensiva,
      defensiva,
      classificacao: classificar(ofensiva),
      perigo: false,
      especiesConhecidas: 1,
      especiesTotal: 1,
    });
    const forteFragil = pontuarParaHunt(av(2, 4), 50, hunt)!;
    const equilibrado = pontuarParaHunt(av(1.8, 1), 50, hunt)!;
    expect(equilibrado).toBeGreaterThan(forteFragil);
    expect(pontuarParaHunt(av(2, 1), 5, hunt)!).toBeLessThan(pontuarParaHunt(av(2, 1), 10, hunt)!);
    expect(pontuarParaHunt(av(2, 1), 10, hunt)).toBe(pontuarParaHunt(av(2, 1), 999, hunt));
    expect(pontuarParaHunt(av(2, 1), undefined, hunt)).toBe(pontuarParaHunt(av(2, 1), 10, hunt));
    expect(pontuarParaHunt(av(2, 0), 10, hunt)).toBeCloseTo(4, 6);
    expect(pontuarParaHunt(av(null, 1), 10, hunt)).toBeNull();
  });

  it('não sugere um atacante forte que apanha super efetivo quando há opção equilibrada', () => {
    const fragil = { ...charmander, id: 10, nome: 'Frágil' };
    const time = [fragil, { ...squirtle, id: 11, nome: 'Equilibrado' }];
    const s = melhorDoTime(geodude, time, especies, tabela);
    expect(s?.pokemon.nome).toBe('Equilibrado');
    expect(s?.pontuacao).toBeGreaterThan(0);
  });

  it('sugere o melhor pokémon do time para a hunt', () => {
    expect(melhorDoTime(geodude, [charmander, squirtle], especies, tabela)?.pokemon.nome).toBe(
      'Squirtle',
    );
    expect(melhorDoTime(bellsprout, [charmander, squirtle], especies, tabela)?.pokemon.nome).toBe(
      'Charmander',
    );
    expect(melhorDoTime(geodude, [{ id: 1 }], especies, tabela)).toBeNull();
    expect(
      melhorDoTime(
        bellsprout,
        [squirtle, { ...squirtle, id: 3, tipos: ['WATER', 'FLYING'] }],
        especies,
        tabela,
      )?.pokemon.id,
    ).toBe(3);
  });
});

describe('catálogos', () => {
  it('ignora entradas inválidas e aceita listas diretas', () => {
    const esp = new CatalogoEspecies();
    expect(
      esp.adicionarJson([{ pokeId: 'x' }, { pokeId: 1, name: 'Sem ataques', type1: 'normal' }]),
    ).toEqual({ adicionadas: 1, invalidas: 1 });
    expect(esp.obter(1)).toMatchObject({ tipos: ['NORMAL'], tiposAtaque: ['NORMAL'] });
    expect(esp.obter(undefined)).toBeUndefined();
    expect(esp.adicionarJson('lixo')).toEqual({ adicionadas: 0, invalidas: 0 });
    expect(esp.tamanho).toBe(1);
    const itens = new CatalogoItens();
    expect(
      itens.adicionarJson({ items: [{ id: 5, name: 'Potion', npcPrice: 10 }, { id: 'x' }] }),
    ).toBe(1);
    itens.adicionar([{ id: 6, name: 'Revive' }]);
    expect(itens.nome('6')).toBe('Revive');
    expect(itens.nome('nome:Seed')).toBe('Seed');
    expect(itens.nome('999')).toBe('Item 999');
    expect(itens.porNome('potion')?.id).toBe(5);
    expect(itens.porNome('Nada')).toBeUndefined();
  });
});

describe('ranking de hunts', () => {
  const { especies, precos } = catalogos();
  const sessaoReal = (slug: string, msAtivo: number, abates: number): Sessao => ({
    ...novaSessao(slug, slug, 0),
    id: `${slug}-${msAtivo}`,
    msAtivo,
    abates,
    xpPokemon: abates * 8,
    xpTreinador: abates * 8,
    gold: abates * 41,
    pocoes: { '11': Math.round(abates / 10) },
  });

  it('sem sessões, mostra o teto teórico sem custo', () => {
    const r = montarRanking({
      hunts,
      sessoes: [],
      catalogo: especies,
      tabela,
      ativo: charmander,
      time: [charmander],
      precos,
      amostraMinimaMs: 900_000,
    });
    expect(r.fatorEficiencia).toBeNull();
    expect(
      r.linhas.every((l) => l.fonte === 'teorico' && l.custoH === null && l.lucroH === null),
    ).toBe(true);
    expect(r.linhas[0]!.xpH).toBeCloseTo(8 * abatesPorHoraTeorico(bellsprout));
  });

  it('usa dados reais e escala as hunts não visitadas pela eficiência observada', () => {
    const teorico = abatesPorHoraTeorico(bellsprout);
    const abates = Math.round((teorico / 2) * 0.5);
    const sessoes = [sessaoReal('bellsprout', 1_800_000, abates), sessaoReal('oddish', 60_000, 5)];
    const r = montarRanking({
      hunts,
      sessoes,
      catalogo: especies,
      tabela,
      ativo: charmander,
      time: [charmander, squirtle],
      precos,
      amostraMinimaMs: 900_000,
    });
    const [b, o, g] = r.linhas;
    expect(b!.fonte).toBe('real');
    expect(b!.custoH).toBeGreaterThan(0);
    expect(o!.fonte).toBe('real-pouca-amostra');
    expect(g!.fonte).toBe('estimado');
    expect(r.fatorEficiencia).toBeCloseTo((abates * 2) / teorico, 6);
    expect(g!.abatesH).toBeCloseTo(abatesPorHoraTeorico(geodude) * r.fatorEficiencia!, 6);
    expect(g!.lucroH).toBeCloseTo(g!.goldH - r.custoPorAbate! * g!.abatesH, 6);
    expect(g!.tipo.classificacao).toBe('desvantagem');
    expect(g!.melhorPokemon?.nome).toBe('Squirtle');
    expect(ordenar(r.linhas, 'lucro').map((l) => l.slug)[0]).toBe('geodude');
    expect(ordenar(r.linhas, 'xp', 5).map((l) => l.slug)).not.toContain('geodude');
  });

  it('aplica VIP e boosts ativos só nas linhas estimadas e teóricas', () => {
    const base = {
      hunts,
      catalogo: especies,
      tabela,
      ativo: charmander,
      time: [charmander],
      precos,
      amostraMinimaMs: 900_000,
    };
    const sessoes = [sessaoReal('bellsprout', 1_800_000, 100)];
    const sem = montarRanking({ ...base, sessoes });
    const com = montarRanking({
      ...base,
      sessoes,
      multiplicadores: {
        xpTreinador: 2,
        xpPokemon: 1.5,
        bonusLootPct: 100,
        ativos: [{ rotulo: 'VIP', mult: 1.5 }],
      },
    });
    const real = (r: typeof sem) => r.linhas.find((l) => l.slug === 'bellsprout')!;
    const est = (r: typeof sem) => r.linhas.find((l) => l.slug === 'geodude')!;
    expect(real(com).xpH).toBe(real(sem).xpH);
    expect(est(com).xpH).toBeCloseTo(est(sem).xpH * 1.5, 6);
    expect(est(com).goldH).toBeCloseTo(ouroPorAbate(geodude.nivel, 100) * est(com).abatesH, 6);
    expect(com.multiplicadores.ativos).toHaveLength(1);
    expect(sem.multiplicadores.ativos).toEqual([]);
  });

  it('com simulador, estima as hunts não visitadas pela força do pokémon e calibra', () => {
    const simular = (h: Hunt) => ({
      abatesH: h.slug === 'geodude' ? 100 : 1000,
      tAbateMedioS: h.slug === 'geodude' ? 36 : 3.6,
      acoesPorAbateMedio: 4,
      segundosParaDesmaiar: 30,
      porEspecie: [],
    });
    const r = montarRanking({
      hunts,
      sessoes: [],
      catalogo: especies,
      tabela,
      ativo: charmander,
      time: [charmander],
      precos,
      amostraMinimaMs: 900_000,
      simular,
      calibracao: { fator: 0.5, sessoes: 3 },
    });
    const g = r.linhas.find((l) => l.slug === 'geodude')!;
    expect(g.fonte).toBe('simulado');
    expect(g.abatesH).toBe(50);
    expect(g.xpH).toBeCloseTo(50 * xpDoNivel(geodude.nivel), 6);
    expect(g.simulacao).toEqual({ tAbateS: 72, acoesPorAbate: 4, segundosParaDesmaiar: 30 });
    expect(r.calibracao).toEqual({ fator: 0.5, sessoes: 3 });
    const semCalib = montarRanking({
      hunts,
      sessoes: [],
      catalogo: especies,
      tabela,
      time: [],
      precos,
      amostraMinimaMs: 900_000,
      simular: (h: Hunt) => (h.slug === 'geodude' ? null : simular(h)),
    });
    expect(semCalib.linhas.find((l) => l.slug === 'bellsprout')!.abatesH).toBe(1000);
    expect(semCalib.linhas.find((l) => l.slug === 'geodude')!.fonte).toBe('teorico');
  });

  it('desempata pela fonte e pelo nível', () => {
    const r = montarRanking({
      hunts: [bellsprout, { ...bellsprout, slug: 'b2', nivel: 1 }],
      sessoes: [],
      catalogo: especies,
      tabela,
      time: [],
      precos,
      amostraMinimaMs: 0,
    });
    expect(ordenar(r.linhas, 'lucro')).toHaveLength(2);
  });
});
