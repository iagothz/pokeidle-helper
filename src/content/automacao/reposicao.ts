import type { RegraReposicao } from '../../shared/preferenciasAutomacao';
import type { Jogador } from '../../domain/estadoJogo';
import type { ContextoAutomacao } from './contexto';

export const ESPERA_ENTRE_COMPRAS_MS = 30_000;

export interface OpcoesReposicao {
  regras: () => readonly RegraReposicao[];
  reservaGold: () => number;
  preco: (kind: RegraReposicao['kind'], id: number) => number | undefined;
}

export interface Compra {
  kind: RegraReposicao['kind'];
  id: number;
  qty: number;
  custo: number;
}

export function estoqueDe(j: Jogador, r: Pick<RegraReposicao, 'kind' | 'id'>): number {
  return (r.kind === 'ball' ? j.bolas : j.itens)[String(r.id)] ?? 0;
}

export class Reposicao {
  private readonly ultimaCompra = new Map<string, number>();
  private readonly avisados = new Set<string>();

  constructor(
    private readonly ctx: ContextoAutomacao,
    private readonly o: OpcoesReposicao,
  ) {}

  tique(): Compra | null {
    const j = this.ctx.jogador();
    if (!j || j.gold === undefined) return null;
    const agora = this.ctx.agora();
    for (const r of this.o.regras()) {
      const chave = `${r.kind}:${r.id}`;
      const estoque = estoqueDe(j, r);
      if (estoque >= r.minimo) {
        this.avisados.delete(chave);
        continue;
      }
      const ultima = this.ultimaCompra.get(chave);
      if (ultima !== undefined && agora - ultima < ESPERA_ENTRE_COMPRAS_MS) continue;
      const preco = this.o.preco(r.kind, r.id);
      if (!preco || preco <= 0) {
        this.avisarUmaVez(chave, 'Item sem preço conhecido na loja; reposição ignorada', r);
        continue;
      }
      const disponivel = j.gold - this.o.reservaGold();
      const qty = Math.min(r.alvo - estoque, Math.floor(disponivel / preco));
      if (qty < 1) {
        this.avisarUmaVez(chave, 'Gold insuficiente para repor', r);
        continue;
      }
      if (!this.ctx.enviar({ t: 'shop.buy', kind: r.kind, id: r.id, qty }, 'reposicao'))
        return null;
      this.ultimaCompra.set(chave, agora);
      this.avisados.delete(chave);
      const compra = { kind: r.kind, id: r.id, qty, custo: qty * preco };
      this.ctx.log.info('Reposição comprada', { ...compra, estoque });
      return compra;
    }
    return null;
  }

  private avisarUmaVez(chave: string, msg: string, r: RegraReposicao) {
    if (this.avisados.has(chave)) return;
    this.avisados.add(chave);
    this.ctx.log.warn(msg, { kind: r.kind, id: r.id });
  }
}
