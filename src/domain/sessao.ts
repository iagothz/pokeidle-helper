import type { Logger } from '../shared/logger';
import {
  ContadorAbate,
  TrechoAberto,
  anexarLimitado,
  type AbateRegistrado,
  type ConsumoRegistrado,
  type IdentidadeTrecho,
  type Trecho,
} from './coletaDetalhada';
import { FASES_ZERADAS, MedidorFases, type Fases } from './medidorFases';
import { idPositivo, lerEvento, type Evento } from './schemas';

export const VERSAO_SESSAO = 5;
export const EF_SUPER_EFETIVO = 2;
const ENTRADA_BOSS_PADRAO = { itemId: 70000, qtd: 1 };

export interface Sessao {
  id: string;
  schemaVersion: number;
  huntSlug: string;
  huntNome: string;
  inicio: number;
  fim: number;
  msAtivo: number;
  xpTreinador: number;
  xpPokemon: number;
  gold: number;
  abates: number;
  capturas: number;
  shiniesVistos: number;
  shinies: number;
  bolas: Record<string, number>;
  pocoes: Record<string, number>;
  revives: Record<string, number>;
  tokens: Record<string, number>;
  drops: Record<string, { nome?: string; qtd: number }>;
  spawns: Record<string, number>;
  golpesRecebidos: number;
  golpesSuperEfetivos: number;
  danoRecebido: number;
  desmaios: number;
  xpPerdido: number;
  fugas: number;
  vendasAuto: number;
  golpesDados: number;
  danoCausado: number;
  fases: Fases;
  pokemon?: PokemonDaSessao;
  sazonal?: SazonalDaSessao;
  trechos: Trecho[];
  abatesDetalhe: AbateRegistrado[];
  consumo: ConsumoRegistrado[];
  aberta: boolean;
}

export interface SazonalDaSessao {
  tipo: string | null;
  escudo: boolean;
}

export interface PokemonDaSessao {
  id: string;
  speciesId?: number;
  level?: number;
  levelFinal?: number;
}

export interface OpcoesRastreador {
  pausaMaximaMs: number;
  sessaoMinimaMs: number;
  agora?: () => number;
  aoSalvar: (sessao: Sessao) => void;
  nomeDaHunt: (slug: string) => string | undefined;
}

const MAX_CHAVES = 256;
const EVENTOS_DE_COMBATE = new Set([
  'spawn',
  'morte',
  'bossMorto',
  'bola',
  'capturado',
  'cura',
  'revive',
]);

function somar(mapa: Record<string, number>, idBruto: unknown, qtd = 1): boolean {
  const id = idPositivo(idBruto);
  if (id == null || !Number.isInteger(qtd) || qtd < 1 || qtd > 1000) return false;
  const chave = String(id);
  if (!(chave in mapa) && Object.keys(mapa).length >= MAX_CHAVES) return false;
  mapa[chave] = (mapa[chave] ?? 0) + qtd;
  return true;
}

export function novaSessao(slug: string, nome: string, inicio: number): Sessao {
  return {
    id: `${slug}-${inicio}`,
    schemaVersion: VERSAO_SESSAO,
    huntSlug: slug,
    huntNome: nome,
    inicio,
    fim: inicio,
    msAtivo: 0,
    xpTreinador: 0,
    xpPokemon: 0,
    gold: 0,
    abates: 0,
    capturas: 0,
    shiniesVistos: 0,
    shinies: 0,
    bolas: {},
    pocoes: {},
    revives: {},
    tokens: {},
    drops: {},
    spawns: {},
    golpesRecebidos: 0,
    golpesSuperEfetivos: 0,
    danoRecebido: 0,
    desmaios: 0,
    xpPerdido: 0,
    fugas: 0,
    vendasAuto: 0,
    golpesDados: 0,
    danoCausado: 0,
    fases: { ...FASES_ZERADAS },
    trechos: [],
    abatesDetalhe: [],
    consumo: [],
    aberta: true,
  };
}

export function normalizarSessao(s: Sessao): Sessao {
  return {
    ...s,
    schemaVersion: VERSAO_SESSAO,
    tokens: s.tokens ?? {},
    golpesRecebidos: s.golpesRecebidos ?? 0,
    golpesSuperEfetivos: s.golpesSuperEfetivos ?? 0,
    danoRecebido: s.danoRecebido ?? 0,
    desmaios: s.desmaios ?? 0,
    xpPerdido: s.xpPerdido ?? 0,
    fugas: s.fugas ?? 0,
    vendasAuto: s.vendasAuto ?? 0,
    golpesDados: s.golpesDados ?? 0,
    danoCausado: s.danoCausado ?? 0,
    fases: s.fases ?? { ...FASES_ZERADAS },
    trechos: s.trechos ?? [],
    abatesDetalhe: s.abatesDetalhe ?? [],
    consumo: s.consumo ?? [],
  };
}

export class RastreadorSessao {
  private atual: Sessao | null = null;
  private ultimoEventoEm: number | null = null;
  private readonly agora: () => number;
  private invalidos = 0;
  private readonly medidor: MedidorFases;
  private readonly contadorAbate = new ContadorAbate();
  private trecho: TrechoAberto | null = null;

  constructor(
    private readonly opcoes: OpcoesRastreador,
    private readonly log: Logger,
  ) {
    this.agora = opcoes.agora ?? Date.now;
    this.medidor = new MedidorFases(opcoes.pausaMaximaMs);
  }

  get sessaoAtual(): Readonly<Sessao> | null {
    return this.atual;
  }

  get eventosInvalidos() {
    return this.invalidos;
  }

  definirHunt(slug: string | null, nome?: string, em = this.agora()): void {
    if (slug === (this.atual?.huntSlug ?? null)) return;
    this.encerrar('troca de hunt', em);
    if (!slug) return;
    this.iniciar(slug, nome ?? this.opcoes.nomeDaHunt(slug) ?? slug, em, {});
  }

  private iniciar(slug: string, nome: string, em: number, identidade: IdentidadeTrecho) {
    this.atual = novaSessao(slug, nome, em);
    this.ultimoEventoEm = null;
    this.medidor.reiniciar();
    this.contadorAbate.reiniciar();
    this.trecho = new TrechoAberto(em, this.atual, identidade);
    this.log.info('Sessão iniciada', { hunt: slug });
  }

  private get ultimoMomento(): number {
    return this.ultimoEventoEm ?? this.atual?.inicio ?? this.agora();
  }

  private trechosCom(s: Sessao, fim: number): Trecho[] {
    return this.trecho ? [...s.trechos, this.trecho.fechar(fim, s)] : s.trechos;
  }

  private virarTrecho(identidade: IdentidadeTrecho) {
    const s = this.atual;
    if (!s || !this.trecho) return;
    const fim = this.ultimoMomento;
    const fechado = this.trecho.fechar(fim, s);
    s.trechos.push(fechado);
    this.log.info('Nível do pokémon mudou', {
      pokemonId: identidade.pokemonId,
      de: fechado.level,
      para: identidade.level,
      abates: fechado.abates,
      golpesPorAbate: fechado.abates > 0 ? fechado.golpesDados / fechado.abates : null,
      msAtivo: fechado.msAtivo,
      xpPokemon: fechado.xpPokemon,
      gold: fechado.gold,
      fases: fechado.fases,
    });
    this.trecho = new TrechoAberto(fim, s, {
      ...identidade,
      ...(s.sazonal ? { tipoSazonal: s.sazonal.tipo } : {}),
    });
  }

  processarEventos(brutos: readonly unknown[], em: number): void {
    for (const bruto of brutos) {
      const ev = lerEvento(bruto);
      if (ev === null) continue;
      if (ev === 'invalido') {
        this.invalidos++;
        if (this.invalidos === 1 || this.invalidos % 100 === 0) {
          this.log.warn('Evento de batalha com formato inesperado', { total: this.invalidos });
        }
        continue;
      }
      if (ev.k === 'hunt') {
        this.definirHunt(ev.slug, ev.nome, em);
        continue;
      }
      if (!this.atual) continue;
      if (EVENTOS_DE_COMBATE.has(ev.k)) this.registrarAtividade(em);
      this.contar(this.atual, ev);
      this.detalhar(this.atual, ev, em);
      this.medidor.registrar(ev, em);
      this.atual.fases = this.medidor.resultado();
    }
  }

  private registrarAtividade(em: number) {
    const s = this.atual;
    if (!s) return;
    if (this.ultimoEventoEm != null && em > this.ultimoEventoEm) {
      s.msAtivo += Math.min(em - this.ultimoEventoEm, this.opcoes.pausaMaximaMs);
    }
    this.ultimoEventoEm = Math.max(em, this.ultimoEventoEm ?? em);
    s.fim = Math.max(s.fim, em);
  }

  private contar(s: Sessao, ev: Evento) {
    switch (ev.k) {
      case 'spawn':
        somar(s.spawns, ev.speciesId);
        break;
      case 'morte':
        if (ev.quem === 'jogador') s.desmaios++;
        if (ev.quem !== 'selvagem') break;
        s.abates++;
        s.xpTreinador += ev.xpTreinador ?? ev.xp ?? 0;
        s.xpPokemon += ev.xpPokemon ?? ev.xp ?? 0;
        s.gold += ev.ouro ?? 0;
        this.somarDrops(s, ev.drops);
        break;
      case 'bossMorto':
        s.xpTreinador += ev.xpTreinador ?? ev.xp ?? 0;
        s.xpPokemon += ev.xpPokemon ?? ev.xp ?? 0;
        s.gold += ev.valor ?? 0;
        this.somarDrops(s, ev.drops);
        break;
      case 'bola':
        if (ev.shiny) s.shiniesVistos++;
        somar(s.bolas, ev.ballId);
        break;
      case 'capturado':
        s.capturas++;
        if (ev.pokemon?.shiny) s.shinies++;
        s.vendasAuto += Math.max(0, ev.vendidoAuto ?? 0);
        break;
      case 'cura':
        somar(s.pocoes, ev.itemId);
        break;
      case 'revive':
        somar(s.revives, ev.itemId);
        break;
      case 'xpPerdido':
        s.xpPerdido += Math.max(0, ev.qtd ?? 0);
        break;
      case 'fugiu':
        s.fugas++;
        break;
      case 'bossEntrou': {
        const entrada = ev.entrada ?? ENTRADA_BOSS_PADRAO;
        somar(s.tokens, entrada.itemId ?? ENTRADA_BOSS_PADRAO.itemId, entrada.qtd ?? 1);
        break;
      }
      case 'ataque':
        if (ev.por === 'jogador') {
          s.golpesDados++;
          s.danoCausado += Math.max(0, ev.dano ?? 0);
          break;
        }
        s.golpesRecebidos++;
        s.danoRecebido += Math.max(0, ev.dano ?? 0);
        if ((ev.ef ?? 0) >= EF_SUPER_EFETIVO) s.golpesSuperEfetivos++;
        break;
      default:
        break;
    }
  }

  private detalhar(s: Sessao, ev: Evento, em: number) {
    switch (ev.k) {
      case 'ataque':
        if (ev.por === 'jogador') this.contadorAbate.golpe(Math.max(0, ev.dano ?? 0), em);
        break;
      case 'morte':
        if (ev.quem === 'jogador') {
          anexarLimitado(s.consumo, { t: em, k: 'desmaio' });
          break;
        }
        if (ev.quem !== 'selvagem') break;
        anexarLimitado(
          s.abatesDetalhe,
          this.contadorAbate.abate(
            em,
            ev.xpPokemon ?? ev.xp ?? 0,
            ev.ouro ?? 0,
            this.trecho?.identidade.level,
          ),
        );
        break;
      case 'cura':
        this.consumir(s, 'pocao', em, ev.itemId);
        break;
      case 'revive':
        this.consumir(s, 'revive', em, ev.itemId);
        break;
      case 'bola':
        this.consumir(s, 'bola', em, ev.ballId);
        break;
      case 'capturado':
        anexarLimitado(s.consumo, capturaRegistrada(em, ev.pokemon, ev.vendidoAuto));
        break;
      default:
        break;
    }
  }

  private consumir(s: Sessao, k: 'pocao' | 'revive' | 'bola', em: number, idBruto: unknown) {
    const id = idPositivo(idBruto);
    if (id === null) return;
    anexarLimitado(s.consumo, { t: em, k, id });
  }

  private somarDrops(
    s: Sessao,
    drops: { itemId?: number | undefined; nome?: string | undefined; qtd?: number | undefined }[],
  ) {
    for (const d of drops) {
      const id = idPositivo(d.itemId);
      const chave = id != null ? String(id) : d.nome ? `nome:${d.nome}` : null;
      if (!chave) continue;
      if (!(chave in s.drops) && Object.keys(s.drops).length >= MAX_CHAVES) continue;
      const atual = s.drops[chave] ?? { qtd: 0, ...(d.nome ? { nome: d.nome } : {}) };
      atual.qtd += Math.max(1, Math.floor(d.qtd ?? 1));
      s.drops[chave] = atual;
    }
  }

  sessaoAoVivo(agora: number): Sessao | null {
    const s = this.atual;
    if (!s) return null;
    const pendente =
      this.ultimoEventoEm !== null && agora > this.ultimoEventoEm
        ? Math.min(agora - this.ultimoEventoEm, this.opcoes.pausaMaximaMs)
        : 0;
    const aoVivo = { ...s, msAtivo: s.msAtivo + pendente, fases: this.medidor.previa(agora) };
    return { ...aoVivo, trechos: this.trechosCom(aoVivo, Math.max(agora, this.ultimoMomento)) };
  }

  registrarSazonal(z: SazonalDaSessao): void {
    const s = this.atual;
    if (!s) return;
    if (!s.sazonal) {
      s.sazonal = { ...z };
      this.trecho?.identificar({ tipoSazonal: z.tipo });
      return;
    }
    if (s.sazonal.tipo === z.tipo && s.sazonal.escudo === z.escudo) return;
    const em = this.ultimoMomento;
    const identidade = { ...(this.trecho?.identidade ?? {}), tipoSazonal: z.tipo };
    const pokemon = s.pokemon;
    this.log.info('Dia sazonal mudou; sessão dividida', { de: s.sazonal, para: z });
    this.encerrar('troca do dia sazonal', em);
    this.iniciar(s.huntSlug, s.huntNome, em, identidade);
    const nova = this.atual as Sessao | null;
    if (!nova) return;
    nova.sazonal = { ...z };
    if (!pokemon) return;
    const level = identidade.level ?? pokemon.levelFinal ?? pokemon.level;
    nova.pokemon = {
      id: pokemon.id,
      ...(pokemon.speciesId !== undefined ? { speciesId: pokemon.speciesId } : {}),
      ...(level !== undefined ? { level } : {}),
    };
  }

  registrarPokemon(p: PokemonDaSessao): void {
    const s = this.atual;
    if (!s) return;
    const identidade: IdentidadeTrecho = {
      pokemonId: p.id,
      ...(p.level !== undefined ? { level: p.level } : {}),
    };
    if (this.trecho?.muda(identidade)) this.virarTrecho(identidade);
    else this.trecho?.identificar(identidade);
    if (!s.pokemon) {
      s.pokemon = { ...p };
      return;
    }
    if (s.pokemon.id === p.id && p.level !== undefined && p.level !== s.pokemon.level)
      s.pokemon = { ...s.pokemon, levelFinal: p.level };
  }

  checkpoint(): void {
    const s = this.atual;
    if (!s || s.msAtivo < this.opcoes.sessaoMinimaMs) return;
    this.salvar({ ...s, trechos: this.trechosCom(s, this.ultimoMomento), aberta: true });
  }

  encerrar(motivo: string, em = this.agora()): void {
    const s = this.atual;
    if (!s) return;
    this.medidor.fechar(Math.min(em, s.fim + this.opcoes.pausaMaximaMs));
    s.fases = this.medidor.resultado();
    s.trechos = this.trechosCom(s, s.fim);
    this.trecho = null;
    this.atual = null;
    this.ultimoEventoEm = null;
    s.fim = Math.max(s.fim, Math.min(em, s.fim + this.opcoes.pausaMaximaMs));
    if (s.msAtivo < this.opcoes.sessaoMinimaMs) {
      this.log.info('Sessão curta descartada', { hunt: s.huntSlug, msAtivo: s.msAtivo, motivo });
      return;
    }
    this.salvar({ ...s, aberta: false });
    this.log.info('Sessão encerrada', {
      hunt: s.huntSlug,
      msAtivo: s.msAtivo,
      abates: s.abates,
      motivo,
    });
  }

  private salvar(s: Sessao) {
    try {
      this.opcoes.aoSalvar(structuredClone(s));
    } catch (erro) {
      this.log.error('Falha ao salvar sessão', {
        erro: erro instanceof Error ? erro.message : String(erro),
      });
    }
  }
}

const positivo = (v: number | undefined) =>
  v !== undefined && Number.isFinite(v) && v > 0 ? v : undefined;

function capturaRegistrada(
  t: number,
  pk:
    | {
        shiny?: boolean | undefined;
        speciesId?: number | undefined;
        level?: number | undefined;
        quality?: number | undefined;
      }
    | undefined,
  vendido: number | undefined,
): ConsumoRegistrado {
  const sp = positivo(pk?.speciesId);
  const lv = positivo(pk?.level);
  const q = positivo(pk?.quality);
  const v = positivo(vendido);
  return {
    t,
    k: 'captura',
    ...(pk?.shiny ? { shiny: true } : {}),
    ...(sp !== undefined ? { sp } : {}),
    ...(lv !== undefined ? { lv } : {}),
    ...(q !== undefined ? { q } : {}),
    ...(v !== undefined ? { v } : {}),
  };
}
