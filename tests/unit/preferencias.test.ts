import { describe, expect, it } from 'vitest';
import {
  PREFERENCIAS_PADRAO,
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
    });
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
