import { CatalogoEspecies, CatalogoItens } from '../../src/domain/catalogo';
import creatures from '../fixtures/creatures.json';
import items from '../fixtures/items.json';
import type { Precos } from '../../src/analysis/taxas';

export function catalogos() {
  const especies = new CatalogoEspecies();
  especies.adicionarJson(creatures);
  const itens = new CatalogoItens();
  itens.adicionarJson(items);
  const precos: Precos = {
    bola: (id) => ({ 1: 50, 2: 300 })[id] ?? 0,
    item: (id) => itens.obter(id)?.npcPrice ?? 0,
  };
  return { especies, itens, precos };
}
