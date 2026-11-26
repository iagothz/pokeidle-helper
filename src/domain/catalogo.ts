import * as z from 'zod';
import type { Item } from './schemas';

const esquemaEspecie = z.object({
  pokeId: z.coerce.number(),
  name: z.string().catch(''),
  type1: z.string().nullable().optional().catch(null),
  type2: z.string().nullable().optional().catch(null),
  huntLevel: z.coerce.number().optional().catch(undefined),
  attacks: z
    .array(z.object({ type: z.string().optional().catch(undefined) }))
    .optional()
    .catch([]),
});

export interface Especie {
  pokeId: number;
  nome: string;
  tipos: string[];
  tiposAtaque: string[];
  huntLevel?: number;
}

const esquemaItemCatalogo = z.object({
  id: z.coerce.number(),
  name: z.string().catch(''),
  category: z.string().optional().catch(undefined),
  npcPrice: z.coerce.number().optional().catch(undefined),
});

function listaDe(json: unknown, chave: string): unknown[] {
  if (Array.isArray(json)) return json;
  const interna =
    json && typeof json === 'object' ? (json as Record<string, unknown>)[chave] : undefined;
  if (Array.isArray(interna)) return interna;
  return [];
}

export class CatalogoEspecies {
  private readonly especies = new Map<number, Especie>();

  adicionarJson(json: unknown): { adicionadas: number; invalidas: number } {
    let adicionadas = 0;
    let invalidas = 0;
    for (const bruto of listaDe(json, 'creatures')) {
      const res = esquemaEspecie.safeParse(bruto);
      if (!res.success) {
        invalidas++;
        continue;
      }
      const e = res.data;
      const tipos = [e.type1, e.type2].filter((t): t is string => !!t).map((t) => t.toUpperCase());
      const tiposAtaque = [
        ...new Set(
          (e.attacks ?? []).map((a) => a.type?.toUpperCase()).filter((t): t is string => !!t),
        ),
      ];
      this.especies.set(e.pokeId, {
        pokeId: e.pokeId,
        nome: e.name,
        tipos: [...new Set(tipos)],
        tiposAtaque: tiposAtaque.length ? tiposAtaque : [...new Set(tipos)],
        ...(e.huntLevel !== undefined ? { huntLevel: e.huntLevel } : {}),
      });
      adicionadas++;
    }
    return { adicionadas, invalidas };
  }

  obter(pokeId: number | undefined): Especie | undefined {
    return pokeId === undefined ? undefined : this.especies.get(pokeId);
  }

  get tamanho() {
    return this.especies.size;
  }
}

export class CatalogoItens {
  private readonly itens = new Map<number, Item>();

  adicionarJson(json: unknown): number {
    let n = 0;
    for (const bruto of listaDe(json, 'items')) {
      const res = esquemaItemCatalogo.safeParse(bruto);
      if (res.success) {
        this.itens.set(res.data.id, res.data);
        n++;
      }
    }
    return n;
  }

  adicionar(itens: Iterable<Item>): void {
    for (const i of itens) this.itens.set(i.id, i);
  }

  obter(id: number): Item | undefined {
    return this.itens.get(id);
  }

  nome(chave: string): string {
    if (chave.startsWith('nome:')) return chave.slice(5);
    return this.itens.get(Number(chave))?.name || `Item ${chave}`;
  }
}
