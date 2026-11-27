import type { Logger } from '../shared/logger';
import {
  CAPTURA_PADRAO,
  PARAMETROS_COMBATE_PADRAO,
  type ParametrosCaptura,
  type ParametrosCombate,
} from './parametros';
import { MescladorEstado } from './mescladorEstado';
import {
  esquemaBatalhaMsg,
  esquemaBola,
  esquemaEstadoMsg,
  esquemaHunt,
  esquemaItem,
  esquemaJogador,
  esquemaPokemon,
  esquemaWelcome,
  esquemaBonusJogador,
  esquemaEvento,
  esquemaTipoBoost,
  lerQuantidades,
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
  xp?: number;
  xpNivel?: number;
  xpProximo?: number;
  activeId?: string;
  huntSlug: string | null;
  noCentro: boolean;
  pokemons: PokemonJogador[];
  itens: Record<string, number>;
  bolas: Record<string, number>;
}

export interface TipoBoost {
  chave: string;
  mult: number;
}

export interface BonusJogador {
  tiposBoost: TipoBoost[];
  loja: { vipAte?: number; boosts: Record<string, number> };
  guildBonusPct?: number;
  guildBoostAte?: number;
  farmEventoPct: number;
}

type Ouvinte = () => void;

const TIPOS_SAZONAIS = new Set([
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

const ehObjeto = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

function lerInstantes(bruto: unknown): Record<string, number> {
  if (!ehObjeto(bruto)) return {};
  const saida: Record<string, number> = {};
  for (const [chave, valor] of Object.entries(bruto)) {
    const n = Number(valor);
    if (typeof valor !== 'boolean' && Number.isFinite(n)) saida[chave] = n;
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
  private readonly mesclador = new MescladorEstado();
  private _hunts: Hunt[] = [];
  private _tabelaTipos: TabelaTipos = {};
  private _bolas = new Map<number, Bola>();
  private _itensJogo = new Map<number, Item>();
  private _tiposBoost: TipoBoost[] = [];
  private _recebeuWelcome = false;
  private _parametrosCombate: ParametrosCombate = { ...PARAMETROS_COMBATE_PADRAO };
  private _captura: ParametrosCaptura = { ...CAPTURA_PADRAO };
  private _chanceShiny: number | null = null;
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
  get parametrosCombate(): ParametrosCombate {
    const sazonal = ehObjeto(this.bruto.diaSazonal) ? this.bruto.diaSazonal.tipo : undefined;
    const tipoSazonal =
      typeof sazonal === 'string' && TIPOS_SAZONAIS.has(sazonal.toUpperCase())
        ? sazonal.toUpperCase()
        : null;
    const nivel = Number(this.bruto.level);
    const alvo = ehObjeto(this.bruto.loja) ? Number(this.bruto.loja.alvoAtrasados) : NaN;
    return {
      ...this._parametrosCombate,
      tipoSazonal,
      escudoSazonal: Number.isFinite(alvo) && alvo > 1 && Number.isFinite(nivel) && nivel < alvo,
    };
  }
  get captura(): ParametrosCaptura {
    return this._captura;
  }
  get chanceShiny(): number | null {
    return this._chanceShiny;
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
      this.bruto = this.mesclador.mesclar(res.data.estado) ?? {};
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
    this.bruto = this.mesclador.mesclar(w.estado) ?? {};
    const hunts = lerLista(w.hunts, esquemaHunt);
    this._hunts = hunts.validos;
    this._tabelaTipos = w.tabelaTipos ?? {};
    this._bolas = new Map(lerLista(w.catalogoBolas, esquemaBola).validos.map((b) => [b.id, b]));
    this._itensJogo = new Map(lerLista(w.itensNossos, esquemaItem).validos.map((i) => [i.id, i]));
    this._tiposBoost = lerLista(w.tiposBoost, esquemaTipoBoost).validos;
    this._parametrosCombate = {
      ...PARAMETROS_COMBATE_PADRAO,
      ...(w.ampliacaoHunt !== undefined ? { ampliacaoHunt: w.ampliacaoHunt } : {}),
      ...(w.multHpSelvagem !== undefined ? { multHpSelvagem: w.multHpSelvagem } : {}),
      ...(w.multDanoSelvagem !== undefined ? { multDanoSelvagem: w.multDanoSelvagem } : {}),
    };
    this._captura = w.captura ?? { ...CAPTURA_PADRAO };
    this._chanceShiny = w.chanceShiny ?? null;
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
    if (Object.keys(this.bruto).length === 0) return null;
    const res = esquemaJogador.safeParse(this.bruto);
    if (!res.success) return null;
    const j = res.data;
    const pokemons = lerLista(j.pokemons, esquemaPokemon).validos;
    this.jogadorCache = {
      ...(j.nick !== undefined ? { nick: j.nick } : {}),
      ...(j.level !== undefined ? { level: j.level } : {}),
      ...(j.gold !== undefined ? { gold: j.gold } : {}),
      ...(j.xp !== undefined ? { xp: j.xp } : {}),
      ...(j.xpNivel !== undefined ? { xpNivel: j.xpNivel } : {}),
      ...(j.xpProximo !== undefined ? { xpProximo: j.xpProximo } : {}),
      ...(j.activeId != null ? { activeId: String(j.activeId) } : {}),
      huntSlug: j.huntSlug ?? null,
      noCentro: j.noCentro ?? false,
      pokemons,
      itens: lerQuantidades(j.items),
      bolas: lerQuantidades(j.balls),
    };
    return this.jogadorCache;
  }

  bonus(agora: number): BonusJogador {
    const res = esquemaBonusJogador.safeParse(this.bruto);
    const b = res.success ? res.data : {};
    const evento = esquemaEvento.safeParse(this.bruto.evento);
    const farmEventoPct =
      evento.success && evento.data.terminaEm > agora ? Math.max(0, evento.data.farmPct) : 0;
    return {
      tiposBoost: this._tiposBoost,
      loja: {
        ...(b.loja?.vipAte !== undefined ? { vipAte: b.loja.vipAte } : {}),
        boosts: lerInstantes(b.loja?.boosts),
      },
      ...(b.guildBonusPct !== undefined ? { guildBonusPct: b.guildBonusPct } : {}),
      ...(b.guild?.boostAte !== undefined ? { guildBoostAte: b.guild.boostAte } : {}),
      farmEventoPct,
    };
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
