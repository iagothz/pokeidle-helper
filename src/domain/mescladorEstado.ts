type Objeto = Record<string, unknown>;
type Id = string | number;

const ehObjeto = (v: unknown): v is Objeto =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function comId(v: unknown): (Objeto & { id: Id }) | null {
  if (!ehObjeto(v)) return null;
  const id = v.id;
  return typeof id === 'string' || typeof id === 'number' ? (v as Objeto & { id: Id }) : null;
}

export class MescladorEstado {
  private campos: Objeto | null = null;
  private pokemons = new Map<Id, Objeto>();

  mesclar(parcial: unknown): Objeto | null {
    if (!ehObjeto(parcial)) return this.atual();
    const { cheio, pokemons, pkMud, pkFora, dexMud, dexFora, ...resto } = parcial;
    if (cheio || !this.campos) {
      this.campos = { ...resto };
      this.pokemons = this.mapaDe(pokemons);
      return this.atual();
    }
    Object.assign(this.campos, resto);
    if (pokemons !== undefined) this.pokemons = this.mapaDe(pokemons);
    for (const pk of lista(pkMud)) {
      const p = comId(pk);
      if (p) this.pokemons.set(p.id, p);
    }
    for (const id of lista(pkFora))
      if (typeof id === 'string' || typeof id === 'number') this.pokemons.delete(id);
    if (dexMud !== undefined || dexFora !== undefined) {
      const fora = new Set(lista(dexFora).map(String));
      const dex = {
        ...(ehObjeto(this.campos.pokedex) ? this.campos.pokedex : {}),
        ...(ehObjeto(dexMud) ? dexMud : {}),
      };
      this.campos.pokedex = Object.fromEntries(Object.entries(dex).filter(([k]) => !fora.has(k)));
    }
    return this.atual();
  }

  atual(): Objeto | null {
    return this.campos ? { ...this.campos, pokemons: [...this.pokemons.values()] } : null;
  }

  limpar(): void {
    this.campos = null;
    this.pokemons.clear();
  }

  private mapaDe(v: unknown): Map<Id, Objeto> {
    const mapa = new Map<Id, Objeto>();
    for (const pk of lista(v)) {
      const p = comId(pk);
      if (p) mapa.set(p.id, p);
    }
    return mapa;
  }
}
