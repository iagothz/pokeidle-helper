import type { Logger } from '../shared/logger';
import {
  esquemaBatalhaMsg,
  esquemaBola,
  esquemaEstadoMsg,
  esquemaHunt,
  esquemaItem,
  esquemaJogador,
  esquemaPokemon,
  esquemaWelcome,
  type Bola,
  type Hunt,
  type Item,
  type PokemonJogador,
  type TabelaTipos,
} from './schemas';

export interface Jogador {
  nick?: string;
  level?: number;
  gold?: number;
  activeId?: string;
  huntSlug: string | null;
  noCentro: boolean;
  pokemons: PokemonJogador[];
}

type Ouvinte = () => void;

const ehObjeto = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

export function mesclarProfundo(
  base: Record<string, unknown>,
  delta: Record<string, unknown>,
): Record<string, unknown> {
  const saida: Record<string, unknown> = { ...base };
  for (const [chave, valor] of Object.entries(delta)) {
    const atual = saida[chave];
    saida[chave] = ehObjeto(atual) && ehObjeto(valor) ? mesclarProfundo(atual, valor) : valor;
  }
  return saida;
}

function lerLista<T>(
  lista: unknown[] | undefined,
  esquema: { safeParse(v: unknown): { success: boolean; data?: T } },
) {
  const validos: T[] = [];
  let invalidos = 0;
  for (const bruto of lista ?? []) {
    const res = esquema.safeParse(bruto);
    if (res.success && res.data !== undefined) validos.push(res.data);
    else invalidos++;
  }
  return { validos, invalidos };
}

export class EstadoJogo {
  private bruto: Record<string, unknown> = {};
  private _hunts: Hunt[] = [];
  private _tabelaTipos: TabelaTipos = {};
  private _bolas = new Map<number, Bola>();
  private _itensJogo = new Map<number, Item>();
  private _recebeuWelcome = false;
  private readonly ouvintes = new Set<Ouvinte>();
  private jogadorCache: Jogador | null = null;

  constructor(private readonly log: Logger) {}

  get recebeuWelcome() {
    return this._recebeuWelcome;
  }
  get hunts(): readonly Hunt[] {
    return this._hunts;
  }
  get tabelaTipos(): TabelaTipos {
    return this._tabelaTipos;
  }
  get bolas(): ReadonlyMap<number, Bola> {
    return this._bolas;
  }
  get itensJogo(): ReadonlyMap<number, Item> {
    return this._itensJogo;
  }

  huntPorSlug(slug: string | null | undefined): Hunt | undefined {
    return slug ? this._hunts.find((h) => h.slug === slug) : undefined;
  }

  inscrever(fn: Ouvinte): () => void {
    this.ouvintes.add(fn);
    return () => this.ouvintes.delete(fn);
  }

  aplicarMensagem(msg: unknown): 'welcome' | 'estado' | 'batalha' | 'ignorada' {
    const t = ehObjeto(msg) ? msg.t : undefined;
    if (t === 'welcome') {
      this.aplicarWelcome(msg);
      return 'welcome';
    }
    if (t === 'estado') {
      const res = esquemaEstadoMsg.safeParse(msg);
      if (!res.success) {
        this.log.warn('Mensagem "estado" fora do formato esperado');
        return 'ignorada';
      }
      this.bruto = mesclarProfundo(this.bruto, res.data.estado);
      this.jogadorCache = null;
      this.notificar();
      return 'estado';
    }
    if (t === 'batalha') return esquemaBatalhaMsg.safeParse(msg).success ? 'batalha' : 'ignorada';
    return 'ignorada';
  }

  private aplicarWelcome(msg: unknown) {
    const res = esquemaWelcome.safeParse(msg);
    if (!res.success) {
      this.log.warn('Mensagem "welcome" fora do formato esperado');
      return;
    }
    const w = res.data;
    const estado = w.estado ?? {};
    this.bruto =
      ehObjeto((msg as Record<string, unknown>).eu) && !ehObjeto(estado.eu)
        ? { ...estado, eu: (msg as Record<string, unknown>).eu }
        : { ...estado };
    const hunts = lerLista(w.hunts, esquemaHunt);
    this._hunts = hunts.validos;
    this._tabelaTipos = w.tabelaTipos ?? {};
    this._bolas = new Map(lerLista(w.catalogoBolas, esquemaBola).validos.map((b) => [b.id, b]));
    this._itensJogo = new Map(lerLista(w.itensNossos, esquemaItem).validos.map((i) => [i.id, i]));
    this._recebeuWelcome = true;
    this.jogadorCache = null;
    if (hunts.invalidos > 0)
      this.log.warn('Hunts ignoradas por formato inesperado', { invalidos: hunts.invalidos });
    this.log.info('Welcome capturado', {
      hunts: this._hunts.length,
      tiposNaTabela: Object.keys(this._tabelaTipos).length,
      bolas: this._bolas.size,
    });
    this.notificar();
  }

  jogador(): Jogador | null {
    if (this.jogadorCache) return this.jogadorCache;
    const res = esquemaJogador.safeParse(this.bruto.eu);
    if (!res.success) return null;
    const j = res.data;
    const pokemons = lerLista(j.pokemons, esquemaPokemon).validos;
    this.jogadorCache = {
      ...(j.nick !== undefined ? { nick: j.nick } : {}),
      ...(j.level !== undefined ? { level: j.level } : {}),
      ...(j.gold !== undefined ? { gold: j.gold } : {}),
      ...(j.activeId != null ? { activeId: String(j.activeId) } : {}),
      huntSlug: j.huntSlug ?? null,
      noCentro: j.noCentro ?? false,
      pokemons,
    };
    return this.jogadorCache;
  }

  pokemonAtivo(): PokemonJogador | undefined {
    const j = this.jogador();
    if (!j) return undefined;
    return j.pokemons.find((p) => String(p.id) === j.activeId) ?? j.pokemons[0];
  }

  private notificar() {
    for (const fn of this.ouvintes) {
      try {
        fn();
      } catch (erro) {
        this.log.error('Ouvinte do estado falhou', {
          erro: erro instanceof Error ? erro.message : String(erro),
        });
      }
    }
  }
}
