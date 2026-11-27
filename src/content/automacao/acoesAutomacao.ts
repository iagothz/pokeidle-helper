import type { CatalogoItens } from '../../domain/catalogo';
import type { EstadoJogo } from '../../domain/estadoJogo';
import type { PreferenciasAutomacao } from '../../shared/preferenciasAutomacao';
import type { AcoesAutomacao, ItemCompravel } from '../../ui/AbaAutomacao';
import { estoqueDe } from './reposicao';
import type { ServicoAutomacao } from './servicoAutomacao';

export const CATEGORIAS_COMPRAVEIS = new Set(['heal', 'revive']);

export interface FontesAcoesAutomacao {
  servico: ServicoAutomacao;
  estado: EstadoJogo;
  itens: CatalogoItens;
  preferencias: () => PreferenciasAutomacao;
  salvar: (p: PreferenciasAutomacao) => void;
}

export function itensCompraveis(estado: EstadoJogo, catalogo: CatalogoItens): ItemCompravel[] {
  const j = estado.jogador();
  const lista: ItemCompravel[] = [];
  for (const b of estado.bolas.values()) {
    if (b.compravel === false || !b.priceGold || b.priceGold <= 0) continue;
    lista.push({
      kind: 'ball',
      id: b.id,
      nome: b.nome ?? b.name ?? `Bola ${b.id}`,
      preco: b.priceGold,
      estoque: j ? estoqueDe(j, { kind: 'ball', id: b.id }) : 0,
    });
  }
  const vistos = new Set<number>();
  for (const i of [...estado.itensJogo.values(), ...catalogo.todos()]) {
    if (vistos.has(i.id)) continue;
    vistos.add(i.id);
    if (!i.category || !CATEGORIAS_COMPRAVEIS.has(i.category) || !i.npcPrice || i.npcPrice <= 0)
      continue;
    lista.push({
      kind: 'item',
      id: i.id,
      nome: i.name || `Item ${i.id}`,
      preco: i.npcPrice,
      estoque: j ? estoqueDe(j, { kind: 'item', id: i.id }) : 0,
    });
  }
  return lista.sort((a, b) => (a.kind === b.kind ? a.preco - b.preco : a.kind === 'ball' ? -1 : 1));
}

export function montarAcoesAutomacao(f: FontesAcoesAutomacao): AcoesAutomacao {
  return {
    preferencias: f.preferencias,
    salvar: f.salvar,
    modelo: () => f.servico.modelo(),
    viajar: (slug) => f.servico.viajar(slug),
    cancelarViagem: () => f.servico.cancelarViagem(),
    itensCompraveis: () => itensCompraveis(f.estado, f.itens),
  };
}
