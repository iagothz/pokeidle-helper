import { describe, expect, it } from 'vitest';
import { carregarCatalogos } from '../../src/content/carregarCatalogos';
import { CONFIG_PADRAO } from '../../src/shared/config';
import creatures from '../fixtures/creatures.json';
import items from '../fixtures/items.json';
import { logDeTeste } from '../helpers/log';

const PLANILHA = `
export const GOLPES_X = {
  69: [
    ['Power Whip', 'GRASS', 'PHYSICAL', 120],
  ],
};
const TABELAS = [
  GOLPES_X,
];
`;

const jogo = CONFIG_PADRAO.jogo;

function fontes(falhar: string[] = []) {
  const json: Record<string, unknown> = {
    [jogo.assetsEspecies[0]!]: creatures,
    [jogo.assetItens]: items,
    [jogo.assetOverrides]: { overrides: [{ pokeId: 74, baseDef: 200 }] },
  };
  return {
    baixarJson: async (c: string) => {
      if (falhar.includes(c) || !(c in json)) throw new Error(`HTTP 404 em ${c}`);
      return json[c];
    },
    baixarTexto: async (c: string) => {
      if (falhar.includes(c)) throw new Error(`HTTP 500 em ${c}`);
      return PLANILHA;
    },
  };
}

describe('carregarCatalogos', () => {
  it('monta espécies com overrides, golpes das planilhas e golpes 600, e itens', async () => {
    const { log, memoria } = logDeTeste();
    const { especies, itens } = await carregarCatalogos(jogo, fontes(), log);
    expect(especies.obter(74)?.bases?.def).toBe(200);
    expect(especies.obter(69)?.golpes.map((g) => g.nome)).toEqual(['Power Whip']);
    expect(itens.obter(11)?.name).toBe('Potion');
    expect(memoria.entradas.some((e) => e.msg === 'Catálogos carregados')).toBe(true);
    expect(memoria.entradas.filter((e) => e.nivel === 'WARN').length).toBe(2);
  });

  it('segue com o que conseguiu baixar quando um asset falha', async () => {
    const { log, memoria } = logDeTeste();
    const { especies } = await carregarCatalogos(
      jogo,
      fontes([jogo.assetGolpes, jogo.assetOverrides]),
      log,
    );
    expect(especies.obter(69)?.golpes.map((g) => g.nome)).toEqual(['Vine Whip', 'Poison Powder']);
    expect(memoria.entradas.filter((e) => e.nivel === 'WARN').length).toBe(4);
  });
});
