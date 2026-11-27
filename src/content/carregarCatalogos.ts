import { CatalogoEspecies, CatalogoItens } from '../domain/catalogo';
import { lerGolpesDasPlanilhas } from '../domain/golpesPlanilhas';
import type { Config } from '../shared/config';
import { erroParaCtx, type Logger } from '../shared/logger';

export interface FontesCatalogo {
  baixarJson(caminho: string): Promise<unknown>;
  baixarTexto(caminho: string): Promise<string>;
}

export async function carregarCatalogos(
  jogo: Config['jogo'],
  fontes: FontesCatalogo,
  log: Logger,
): Promise<{ especies: CatalogoEspecies; itens: CatalogoItens }> {
  const especies = new CatalogoEspecies();
  const itens = new CatalogoItens();
  const tentar = async <T>(
    caminho: string,
    baixar: (c: string) => Promise<T>,
  ): Promise<T | null> => {
    try {
      return await baixar(caminho);
    } catch (erro) {
      log.warn('Catálogo indisponível', { caminho, ...erroParaCtx(erro) });
      return null;
    }
  };

  const [listas, jsonItens, overrides, planilha] = await Promise.all([
    Promise.all(jogo.assetsEspecies.map((c) => tentar(c, fontes.baixarJson))),
    tentar(jogo.assetItens, fontes.baixarJson),
    tentar(jogo.assetOverrides, fontes.baixarJson),
    tentar(jogo.assetGolpes, fontes.baixarTexto),
  ]);
  for (const lista of listas) if (lista !== null) especies.adicionarJson(lista);
  if (jsonItens !== null) itens.adicionarJson(jsonItens);
  const comOverride = overrides !== null ? especies.aplicarOverridesJson(overrides) : 0;
  const planilhas = planilha !== null ? lerGolpesDasPlanilhas(planilha) : null;
  const comGolpes = planilhas ? especies.substituirGolpes(planilhas.golpes) : 0;
  especies.completarGolpesEspeciais(planilhas?.fechadas ?? new Set());
  log.info('Catálogos carregados', {
    especies: especies.tamanho,
    comOverride,
    comGolpesDasPlanilhas: comGolpes,
  });
  return { especies, itens };
}
