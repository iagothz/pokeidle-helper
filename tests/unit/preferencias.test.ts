import { describe, expect, it } from 'vitest';
import {
  FILTROS_PADRAO,
  PREFERENCIAS_PADRAO,
  TAMANHOS_PAINEL,
  limitarPosicao,
  lerPreferencias,
} from '../../src/shared/preferencias';

describe('lerPreferencias', () => {
  it('aceita preferências válidas', () => {
    expect(
      lerPreferencias({ posicao: { x: 10, y: 20 }, minimizado: true, aba: 'historico' }),
    ).toEqual({
      posicao: { x: 10, y: 20 },
      minimizado: true,
      aba: 'historico',
      backupAutomatico: true,
      tamanho: 0,
      filtros: FILTROS_PADRAO,
    });
  });

  it('guarda os filtros das abas', () => {
    const filtros = {
      huntsCriterio: 'xp',
      huntsAteNivelAtivo: true,
      timePokemon: '42',
      timeCriterio: 'gold',
      historicoHunt: 'sunkern',
      metas: { Treinador: 400, Ativo: 390 },
    };
    expect(lerPreferencias({ filtros }).filtros).toEqual(filtros);
  });

  it('filtro inválido volta ao padrão só naquele campo', () => {
    expect(
      lerPreferencias({
        filtros: {
          huntsCriterio: 'hack',
          huntsAteNivelAtivo: true,
          timePokemon: 7,
          metas: { Treinador: -1, Ativo: 12.5, Outro: 50 },
        },
      }).filtros,
    ).toEqual({ ...FILTROS_PADRAO, huntsAteNivelAtivo: true, metas: { Outro: 50 } });
    expect(lerPreferencias({ filtros: 'lixo' }).filtros).toEqual(FILTROS_PADRAO);
  });

  it('guarda o tamanho do painel dentro dos tamanhos disponíveis', () => {
    expect(lerPreferencias({ tamanho: 2 }).tamanho).toBe(2);
    expect(lerPreferencias({ tamanho: 99 }).tamanho).toBe(0);
    expect(lerPreferencias({ tamanho: 1.5 }).tamanho).toBe(0);
    expect(TAMANHOS_PAINEL[0]).toEqual({ largura: 400, alturaVh: 76 });
    expect(TAMANHOS_PAINEL.length).toBeGreaterThanOrEqual(4);
  });

  it('descarta campos inválidos e volta ao padrão', () => {
    expect(lerPreferencias(undefined)).toEqual(PREFERENCIAS_PADRAO);
    expect(lerPreferencias('lixo')).toEqual(PREFERENCIAS_PADRAO);
    expect(lerPreferencias({ posicao: { x: 'a' }, minimizado: 'sim', aba: 'hack' })).toEqual(
      PREFERENCIAS_PADRAO,
    );
    expect(lerPreferencias({ posicao: { x: Infinity, y: 1 } }).posicao).toBeNull();
  });
});

describe('limitarPosicao', () => {
  const tela = { largura: 1000, altura: 800 };
  const painel = { largura: 380, altura: 500 };

  it('mantém o painel inteiro dentro da janela', () => {
    expect(limitarPosicao({ x: 50, y: 60 }, painel, tela)).toEqual({ x: 50, y: 60 });
    expect(limitarPosicao({ x: -30, y: -5 }, painel, tela)).toEqual({ x: 0, y: 0 });
    expect(limitarPosicao({ x: 900, y: 790 }, painel, tela)).toEqual({ x: 620, y: 300 });
  });

  it('em janela menor que o painel encosta no canto superior esquerdo', () => {
    expect(limitarPosicao({ x: 100, y: 100 }, painel, { largura: 300, altura: 200 })).toEqual({
      x: 0,
      y: 0,
    });
  });
});
