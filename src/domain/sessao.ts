import type { Logger } from '../shared/logger';
import { idPositivo, lerEvento, type Evento } from './schemas';

export const VERSAO_SESSAO = 3;
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
  pokemon?: PokemonDaSessao;
  aberta: boolean;
}

export interface PokemonDaSessao {
  id: string;
  speciesId?: number;
  level?: number;
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
  };
}

export class RastreadorSessao {
  private atual: Sessao | null = null;
  private ultimoEventoEm: number | null = null;
  private readonly agora: () => number;
  private invalidos = 0;

  constructor(
    private readonly opcoes: OpcoesRastreador,
    private readonly log: Logger,
  ) {
    this.agora = opcoes.agora ?? Date.now;
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
    this.atual = novaSessao(slug, nome ?? this.opcoes.nomeDaHunt(slug) ?? slug, em);
    this.ultimoEventoEm = null;
    this.log.info('Sessão iniciada', { hunt: slug });
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
        if (ev.por === 'jogador') break;
        s.golpesRecebidos++;
        s.danoRecebido += Math.max(0, ev.dano ?? 0);
        if ((ev.ef ?? 0) >= EF_SUPER_EFETIVO) s.golpesSuperEfetivos++;
        break;
      default:
        break;
    }
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

  registrarPokemon(p: PokemonDaSessao): void {
    if (this.atual && !this.atual.pokemon) this.atual.pokemon = { ...p };
  }

  checkpoint(): void {
    const s = this.atual;
    if (!s || s.msAtivo < this.opcoes.sessaoMinimaMs) return;
    this.salvar({ ...s, aberta: true });
  }

  encerrar(motivo: string, em = this.agora()): void {
    const s = this.atual;
    if (!s) return;
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
