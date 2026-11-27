import * as z from 'zod';
import type { Item } from './schemas';

const numeroOpcional = z.coerce.number().optional().catch(undefined);

const esquemaGolpe = z.object({
  name: z.string().catch(''),
  type: z.string().optional().catch(undefined),
  category: z.string().optional().catch(undefined),
  power: numeroOpcional,
  cooldownMs: numeroOpcional,
  learnLevel: numeroOpcional,
});

const esquemaEspecie = z.object({
  pokeId: z.coerce.number(),
  name: z.string().catch(''),
  type1: z.string().nullable().optional().catch(null),
  type2: z.string().nullable().optional().catch(null),
  huntLevel: numeroOpcional,
  baseHp: numeroOpcional,
  baseAtk: numeroOpcional,
  baseDef: numeroOpcional,
  baseSpAtk: numeroOpcional,
  baseSpDef: numeroOpcional,
  baseSpeed: numeroOpcional,
  evolvesToId: numeroOpcional,
  evolveLevel: numeroOpcional,
  priceNpc: numeroOpcional,
  attacks: z.array(esquemaGolpe.partial()).optional().catch([]),
});

export type Categoria = 'PHYSICAL' | 'SPECIAL';

export interface Golpe {
  nome: string;
  tipo: string;
  categoria: Categoria;
  poder: number;
  cooldownMs: number;
  nivelAprende: number;
}

export interface Bases {
  hp: number;
  atk: number;
  def: number;
  spAtk: number;
  spDef: number;
  speed: number;
}

export interface Especie {
  pokeId: number;
  nome: string;
  tipos: string[];
  tiposAtaque: string[];
  huntLevel?: number;
  bases: Bases | null;
  golpes: Golpe[];
  evolvesToId: number;
  evolveLevel: number;
  priceNpc: number;
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

function basesDe(e: z.infer<typeof esquemaEspecie>): Bases | null {
  const {
    baseHp: hp,
    baseAtk: atk,
    baseDef: def,
    baseSpAtk: spAtk,
    baseSpDef: spDef,
    baseSpeed: speed,
  } = e;
  if (
    hp === undefined ||
    atk === undefined ||
    def === undefined ||
    spAtk === undefined ||
    spDef === undefined ||
    speed === undefined
  )
    return null;
  if (![hp, atk, def, spAtk, spDef, speed].every(Number.isFinite)) return null;
  return { hp, atk, def, spAtk, spDef, speed };
}

function golpeDe(g: Partial<z.infer<typeof esquemaGolpe>>): Golpe | null {
  if (!g.name || !g.type || g.power === undefined || !(g.power > 0)) return null;
  return {
    nome: g.name,
    tipo: g.type.toUpperCase(),
    categoria: g.category?.toUpperCase() === 'PHYSICAL' ? 'PHYSICAL' : 'SPECIAL',
    poder: g.power,
    cooldownMs: g.cooldownMs ?? 0,
    nivelAprende: g.learnLevel ?? 1,
  };
}

const esquemaOverride = z.object({
  pokeId: z.coerce.number(),
  baseHp: numeroOpcional,
  baseAtk: numeroOpcional,
  baseDef: numeroOpcional,
  baseSpAtk: numeroOpcional,
  baseSpDef: numeroOpcional,
  baseSpeed: numeroOpcional,
  attacks: z.array(esquemaGolpe.partial()).optional().catch(undefined),
});

const PODER_ESPECIAL = 600;
const COOLDOWN_ESPECIAL_MS = 60_000;
const TIPOS_ELEMENTO = new Set([
  'NORMAL',
  'FIRE',
  'WATER',
  'GRASS',
  'ELECTRIC',
  'ICE',
  'FIGHTING',
  'POISON',
  'GROUND',
  'FLYING',
  'PSYCHIC',
  'BUG',
  'ROCK',
  'GHOST',
  'DRAGON',
  'DARK',
  'STEEL',
  'FAIRY',
]);

function completarGolpes600(e: Especie): Golpe[] {
  const categoria: Categoria =
    (e.bases?.atk ?? 0) >= (e.bases?.spAtk ?? 0) ? 'PHYSICAL' : 'SPECIAL';
  const golpes = e.golpes.map((g) =>
    g.poder >= PODER_ESPECIAL ? { ...g, categoria, cooldownMs: COOLDOWN_ESPECIAL_MS } : g,
  );
  const especial = (tipo: string, n: number): Golpe => ({
    nome: `${tipo} ${PODER_ESPECIAL}${n > 1 ? ` ${n}` : ''}`,
    tipo,
    categoria,
    poder: PODER_ESPECIAL,
    cooldownMs: COOLDOWN_ESPECIAL_MS,
    nivelAprende: 1,
  });
  for (const tipo of e.tipos.filter((t) => TIPOS_ELEMENTO.has(t)))
    if (!golpes.some((g) => g.poder >= PODER_ESPECIAL && g.tipo === tipo))
      golpes.push(especial(tipo, 1));
  const de600 = golpes.filter((g) => g.poder >= PODER_ESPECIAL && TIPOS_ELEMENTO.has(g.tipo));
  const unico = de600.length === 1 ? de600[0] : undefined;
  if (unico) golpes.push(especial(unico.tipo, 2));
  const mudou = golpes.length !== e.golpes.length || golpes.some((g, i) => g !== e.golpes[i]);
  return mudou ? golpes : e.golpes;
}

function tiposDosGolpes(golpes: readonly { tipo?: string | undefined }[]): string[] {
  return [...new Set(golpes.map((g) => g.tipo?.toUpperCase()).filter((t): t is string => !!t))];
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
      const tipos = [
        ...new Set([e.type1, e.type2].filter((t): t is string => !!t).map((t) => t.toUpperCase())),
      ];
      const golpes = (e.attacks ?? []).map(golpeDe).filter((g): g is Golpe => g !== null);
      const tiposAtaque = tiposDosGolpes((e.attacks ?? []).map((a) => ({ tipo: a.type })));
      this.especies.set(e.pokeId, {
        pokeId: e.pokeId,
        nome: e.name,
        tipos,
        tiposAtaque: tiposAtaque.length ? tiposAtaque : tipos,
        ...(e.huntLevel !== undefined ? { huntLevel: e.huntLevel } : {}),
        bases: basesDe(e),
        golpes,
        evolvesToId: e.evolvesToId ?? 0,
        evolveLevel: e.evolveLevel ?? 0,
        priceNpc: e.priceNpc ?? 0,
      });
      adicionadas++;
    }
    return { adicionadas, invalidas };
  }

  aplicarOverridesJson(json: unknown): number {
    let n = 0;
    for (const bruto of listaDe(json, 'overrides')) {
      const res = esquemaOverride.safeParse(bruto);
      if (!res.success) continue;
      const o = res.data;
      const e = this.especies.get(o.pokeId);
      if (!e) continue;
      const bases = e.bases
        ? {
            hp: o.baseHp ?? e.bases.hp,
            atk: o.baseAtk ?? e.bases.atk,
            def: o.baseDef ?? e.bases.def,
            spAtk: o.baseSpAtk ?? e.bases.spAtk,
            spDef: o.baseSpDef ?? e.bases.spDef,
            speed: o.baseSpeed ?? e.bases.speed,
          }
        : null;
      const golpes = o.attacks
        ? o.attacks.map(golpeDe).filter((g): g is Golpe => g !== null)
        : e.golpes;
      this.especies.set(o.pokeId, { ...e, bases, golpes });
      n++;
    }
    return n;
  }

  completarGolpesEspeciais(fechadas: ReadonlySet<number>): void {
    for (const e of this.especies.values()) {
      if (e.evolvesToId || fechadas.has(e.pokeId)) continue;
      const golpes = completarGolpes600(e);
      if (golpes !== e.golpes) this.especies.set(e.pokeId, { ...e, golpes });
    }
  }

  substituirGolpes(porEspecie: ReadonlyMap<number, Golpe[]>): number {
    let n = 0;
    for (const [id, golpes] of porEspecie) {
      const e = this.especies.get(id);
      if (!e || golpes.length === 0) continue;
      const tiposAtaque = tiposDosGolpes(golpes);
      this.especies.set(id, {
        ...e,
        golpes,
        tiposAtaque: tiposAtaque.length ? tiposAtaque : e.tipos,
      });
      n++;
    }
    return n;
  }

  obter(pokeId: number | undefined): Especie | undefined {
    return pokeId === undefined ? undefined : this.especies.get(pokeId);
  }

  todas(): IterableIterator<Especie> {
    return this.especies.values();
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

  todos(): IterableIterator<Item> {
    return this.itens.values();
  }

  porNome(nome: string): Item | undefined {
    const alvo = nome.trim().toLowerCase();
    for (const item of this.itens.values()) if (item.name.toLowerCase() === alvo) return item;
    return undefined;
  }

  nome(chave: string): string {
    if (chave.startsWith('nome:')) return chave.slice(5);
    return this.itens.get(Number(chave))?.name || `Item ${chave}`;
  }
}
