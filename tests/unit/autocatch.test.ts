import { describe, expect, it } from 'vitest';
import { analisarAutocatch, type EntradaAutocatch } from '../../src/analysis/autocatch';
import type { ConsumoRegistrado, Trecho } from '../../src/domain/coletaDetalhada';
import { novaSessao, type Sessao } from '../../src/domain/sessao';

const PRECO_BOLA = 50;
const golpesDoNivel = (lv: number) => 1 + Math.exp(3.6 - 0.015 * lv);

function trecho(lv: number, extraS = 0): Trecho {
  const abates = 100;
  const g = golpesDoNivel(lv);
  return {
    inicio: lv * 10_000_000,
    fim: lv * 10_000_000 + 1_000_000,
    pokemonId: '9',
    level: lv,
    tipoSazonal: null,
    msAtivo: Math.round((2.9 + 0.65 * g + extraS) * abates * 1000),
    abates,
    golpesDados: Math.round(g * abates),
    danoCausado: 0,
    xpPokemon: 40_000 * abates,
    gold: 1_000 * abates,
    desmaios: 0,
    fases: { lutaMs: 0, deslocamentoMs: 0, esperaMs: 0, ondas: 0 },
  };
}

function sessao(
  id: string,
  trechos: Trecho[],
  bolasPorTrecho: number,
  capturas: ConsumoRegistrado[],
): Sessao {
  const bolas: ConsumoRegistrado[] = trechos.flatMap((t) =>
    Array.from({ length: bolasPorTrecho }, (_, i) => ({
      t: t.inicio + 1 + i,
      k: 'bola' as const,
      id: 4,
    })),
  );
  const total = bolas.length;
  return {
    ...novaSessao('sunkern', 'Sunkern', 0),
    id,
    aberta: false,
    msAtivo: trechos.reduce((s, t) => s + t.msAtivo, 0),
    abates: trechos.reduce((s, t) => s + t.abates, 0),
    bolas: total ? { '4': total } : {},
    capturas: capturas.length,
    vendasAuto: capturas.reduce((s, c) => s + (c.v ?? 0), 0),
    trechos,
    consumo: [...bolas, ...capturas],
  };
}

const captura = (t: number, v?: number): ConsumoRegistrado => ({
  t,
  k: 'captura',
  sp: 191,
  ...(v !== undefined ? { v } : {}),
});

const semBola = sessao(
  'sem',
  [200, 201, 202, 203, 204, 205].map((lv) => trecho(lv)),
  0,
  [],
);
const comBola = sessao(
  'com',
  [206, 207, 208].map((lv) => trecho(lv, 0.4)),
  60,
  [captura(1, 27_000), captura(2, 29_000), captura(3, 28_000)],
);

function entrada(sessoes: Sessao[], extra: Partial<EntradaAutocatch> = {}): EntradaAutocatch {
  return {
    sessoes,
    precoBola: (id) => (id === 4 ? PRECO_BOLA : 0),
    xpPorAbate: 40_000,
    ouroPorAbate: 1_000,
    abatesHSem: 900,
    chanceCalibrada: null,
    ...extra,
  };
}

describe('analisarAutocatch', () => {
  it('mede bolas por captura, por abate, custo e valor médio de venda', () => {
    const a = analisarAutocatch(entrada([semBola, comBola]));
    expect(a.amostra).toMatchObject({ bolas: 180, capturas: 3, capturasVendidas: 3 });
    expect(a.bolasPorCaptura).toBe(60);
    expect(a.fonteBolasPorCaptura).toBe('medido');
    expect(a.bolasPorAbate).toBeCloseTo(180 / 300, 6);
    expect(a.custoPorBola).toBe(PRECO_BOLA);
    expect(a.valorPorCaptura).toBe(28_000);
  });

  it('mede o tempo extra por abate dos trechos com bola contra o ciclo sem bola', () => {
    const a = analisarAutocatch(entrada([semBola, comBola]));
    expect(a.segundosExtrasPorAbate).toBeCloseTo(0.4, 1);
    const ciclo = 3600 / 900;
    expect(a.abatesHCom).toBeCloseTo(3600 / (ciclo + a.segundosExtrasPorAbate!), 3);
  });

  it('calcula gold líquido por hora e variação de XP/h', () => {
    const a = analisarAutocatch(entrada([semBola, comBola]));
    const com = a.abatesHCom;
    const bolasH = com * a.bolasPorAbate!;
    const vendasH = (bolasH / 60) * 28_000;
    const custoH = bolasH * PRECO_BOLA;
    const ouroPerdidoH = (900 - com) * 1_000;
    expect(a.gold?.vendasH).toBeCloseTo(vendasH, 3);
    expect(a.gold?.bolasH).toBeCloseTo(custoH, 3);
    expect(a.gold?.abatesPerdidosH).toBeCloseTo(ouroPerdidoH, 3);
    expect(a.gold?.liquidoH).toBeCloseTo(vendasH - custoH - ouroPerdidoH, 3);
    expect(a.deltaXpH).toBeCloseTo((com - 900) * 40_000, 3);
    expect(a.pendencias).toEqual([]);
  });

  it('sem capturas suficientes usa a chance estimada e pede mais amostra', () => {
    const pouco = sessao('pouco', [trecho(206, 0.4)], 50, [captura(1, 28_000)]);
    const a = analisarAutocatch(entrada([semBola, pouco], { chanceCalibrada: 0.005 }));
    expect(a.bolasPorCaptura).toBe(200);
    expect(a.fonteBolasPorCaptura).toBe('estimado');
    expect(a.pendencias).toContain('poucasCapturas');
  });

  it('sem vendas automáticas não calcula gold e pede a Auto Venda', () => {
    const semVenda = sessao(
      'sv',
      [206, 207, 208].map((lv) => trecho(lv, 0.4)),
      60,
      [captura(1), captura(2), captura(3)],
    );
    const a = analisarAutocatch(entrada([semBola, semVenda]));
    expect(a.valorPorCaptura).toBeNull();
    expect(a.gold).toBeNull();
    expect(a.pendencias).toContain('semVenda');
  });

  it('sem trechos sem bola suficientes assume tempo extra zero e avisa', () => {
    const a = analisarAutocatch(entrada([comBola]));
    expect(a.segundosExtrasPorAbate).toBeNull();
    expect(a.abatesHCom).toBe(900);
    expect(a.deltaXpH).toBe(0);
    expect(a.pendencias).toContain('semTempo');
  });

  it('sem nenhuma bola jogada pede para ligar o autocatch', () => {
    const a = analisarAutocatch(entrada([semBola], { chanceCalibrada: null }));
    expect(a.amostra.bolas).toBe(0);
    expect(a.bolasPorAbate).toBeNull();
    expect(a.bolasPorCaptura).toBeNull();
    expect(a.gold).toBeNull();
    expect(a.pendencias).toContain('semBolas');
  });
});
