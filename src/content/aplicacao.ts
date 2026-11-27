import type { EnvelopeValido } from '../bridge/receptor';
import type { CatalogoEspecies, CatalogoItens } from '../domain/catalogo';
import type { EstadoJogo } from '../domain/estadoJogo';
import type { Fases } from '../domain/medidorFases';
import { RastreadorSessao, normalizarSessao, type Sessao } from '../domain/sessao';
import type { Hunt, PokemonJogador } from '../domain/schemas';
import {
  avaliarHunt,
  melhorDoTime,
  pontuarParaHunt,
  tiposDoPokemon,
  type AvaliacaoTipo,
} from '../analysis/dicasTipo';
import { calcularAutonomia, type Autonomia } from '../analysis/autonomia';
import { avaliarDanoRecebido, type AvaliacaoDano } from '../analysis/danoRecebido';
import {
  ajustarCurvaNivel,
  projetarProgressao,
  trechosDaHunt,
  type CurvaNivel,
  type Projecao,
  type BonusNoTempo,
} from '../analysis/curvaNivel';
import { montarHistorico, type Historico } from '../analysis/historico';
import { previsaoDeNivel, type PrevisaoNivel } from '../analysis/metas';
import {
  FAIXA_NEUTRA,
  calcularMultiplicadores,
  faixaEm,
  faixasDeBonus,
  type BonusAtivo,
  type Multiplicadores,
} from '../analysis/multiplicadores';
import { montarRanking, type ResultadoRanking } from '../analysis/ranking';
import { agregar, taxasDe, type Precos, type Taxas } from '../analysis/taxas';
import type { Config } from '../shared/config';
import type { Logger } from '../shared/logger';
import { erroParaCtx } from '../shared/logger';
import { VERSAO_JOGO_VALIDADA } from '../shared/protocolo';
import type { Calibracao } from '../analysis/calibracao';
import { ServicoSimulacao, type AnaliseDoPokemon } from './servicoSimulacao';
import { dadosDeCombate, montarResumoSessao } from './resumoSessao';
import { lerBackup, mesclarSessoes, montarBackup, type Backup } from '../domain/backup';
import { analisarAutocatch, type AnaliseAutocatch } from '../analysis/autocatch';
import {
  amostrasDeCaptura,
  calibrarChance,
  fatorGlobalCaptura,
} from '../analysis/calibracaoCaptura';
import { analisarCaptura } from '../analysis/economia';
import { ouroPorAbate, xpDoNivel } from '../analysis/formulasJogo';
import {
  chanceMediaDaBola,
  montarEconomia,
  type ChanceDaBola,
  type Economia,
} from './servicoEconomia';
import {
  FOLGA_NIVEL_POKEMON,
  custoRefino,
  pokemonsTravados,
  progressoEvolucao,
  type PokemonTravado,
  type ProgressoEvolucao,
  type QuemGanhaXp,
  type RitmoXp,
} from '../analysis/progressao';

const AMOSTRA_RITMO_MS = 5 * 60_000;
const MS_HORA = 3_600_000;

interface RitmosDeXp {
  agora: number;
  mult: Multiplicadores;
  bonus: BonusNoTempo;
  treinador: RitmoXp;
  pokemon: RitmoXp;
}

const xpHAgora = (r: RitmoXp) => r.xpHBase * faixaEm(r.faixas, 0).faixa[r.quem];
const DIA_MS = 86_400_000;
const NOME_FRAGMENTO_OVO = 'Shiny Egg Fragment';

export interface RepositorioSessoesPorta {
  salvar(s: Sessao): Promise<unknown>;
  listar(): Promise<Sessao[]>;
  limpar(): Promise<void>;
}

export interface ItemConsumido {
  nome: string;
  qtd: number;
  custo: number;
}

export interface ItemDrop {
  nome: string;
  qtd: number;
  aCadaAbates: number | null;
}

export interface ValoresHunt {
  xp: number;
  lucro: number;
  gold: number;
  abates: number;
}

export interface ReferenciaHunt {
  outras: { xp: number[]; lucro: number[]; gold: number[]; abates: number[] };
  historico: ValoresHunt | null;
}

export interface ModeloSessao {
  huntSlug: string;
  huntNome: string;
  taxas: Taxas;
  abates: number;
  capturas: number;
  fugas: number;
  desmaios: number;
  xpPerdido: number;
  metas: { treinador: PrevisaoNivel | null; pokemon: PrevisaoNivel | null };
  consumidos: ItemConsumido[];
  drops: ItemDrop[];
  autonomia: Autonomia;
  tipo: AvaliacaoTipo | null;
  dano: AvaliacaoDano;
  referencia: ReferenciaHunt;
  fases: Fases;
  golpesDados: number;
  danoCausado: number;
  sugestao: PokemonJogador | null;
  ativo: PokemonJogador | null;
}

export interface Diagnostico {
  versao: string;
  versaoJogo: string | null;
  welcome: boolean;
  especies: number;
  sessoesSalvas: number;
  eventosInvalidos: number;
  captura: Record<string, number> | null;
  ultimaMensagemEm: number | null;
  dadosAtivo: { ivs: boolean; qualidade: boolean; stats: boolean; golpes: number } | null;
}

export interface AnaliseTime {
  huntNome: string;
  huntNivel: number;
  ativoId: string | null;
  linhas: AnaliseDoPokemon[];
  calibracao: Calibracao | null;
}

export interface RefinoStat {
  stat: string;
  pontos: number;
  proximo: number;
}

export interface ModeloProgresso {
  treinador: { level: number | null; xp: number | null; xpH: number };
  ativo: {
    pokemon: PokemonJogador;
    xpH: number;
    evolucao: ProgressoEvolucao | null;
    refino: RefinoStat[];
  } | null;
  travados: PokemonTravado<PokemonJogador>[];
  ritmo: 'sessao' | 'simulado' | 'nenhum';
  ritmoTreinador: RitmoXp;
  ritmoPokemon: RitmoXp;
  bonus: { agora: number; ativos: BonusAtivo[] };
  curvaNivel: CurvaDaHunt | null;
}

export interface CurvaDaHunt {
  huntNome: string;
  tipoSazonal: string | null;
  curva: CurvaNivel;
  projecao: Projecao;
  bonus: BonusNoTempo;
}

export interface ResultadoImportacao {
  formatoValido: boolean;
  novas: number;
  atualizadas: number;
  mantidas: number;
  invalidas: number;
}

export interface Modelo {
  status: 'aguardando-login' | 'pronto';
  time: AnaliseTime | null;
  progresso: ModeloProgresso | null;
  economia: Economia | null;
  sessao: ModeloSessao | null;
  ranking: ResultadoRanking | null;
  nivelAtivo: number | null;
  avisos: string[];
  diagnostico: Diagnostico;
}

export interface DependenciasAplicacao {
  config: Config;
  log: Logger;
  estado: EstadoJogo;
  repositorio: RepositorioSessoesPorta;
  especies: CatalogoEspecies;
  itens: CatalogoItens;
  versao: string;
  agora?: () => number;
  aoFecharSessao?: () => void;
}

export class Aplicacao {
  readonly rastreador: RastreadorSessao;
  private readonly sessoes = new Map<string, Sessao>();
  private readonly ouvintes = new Set<() => void>();
  private readonly avisos = new Set<string>();
  private capturaStats: Record<string, number> | null = null;
  private ultimaMensagemEm: number | null = null;
  private cacheRanking: ResultadoRanking | null = null;
  private versaoJogo: string | null = null;
  private cacheTime: AnaliseTime | null = null;
  private analisesValidasAte = Infinity;
  private readonly ativosLogados = new Set<string>();
  private diaCarimbado: number | null = null;
  private cacheFormulaCaptura: {
    hunts: unknown;
    valores: Map<string, number | null>;
  } = { hunts: null, valores: new Map() };
  readonly simulacao: ServicoSimulacao;
  private readonly log: Logger;

  constructor(private readonly d: DependenciasAplicacao) {
    this.log = d.log;
    this.simulacao = new ServicoSimulacao(d.estado, d.especies);
    this.rastreador = new RastreadorSessao(
      {
        pausaMaximaMs: d.config.pausaMaximaMs,
        sessaoMinimaMs: d.config.sessaoMinimaMs,
        ...(d.agora ? { agora: d.agora } : {}),
        aoSalvar: (s) => this.salvarSessao(s),
        nomeDaHunt: (slug) => d.estado.huntPorSlug(slug)?.nome,
      },
      d.log.filho('sessao'),
    );
    d.estado.inscrever(() => this.aoMudarEstado());
  }

  async carregarHistorico(): Promise<void> {
    try {
      for (const s of await this.d.repositorio.listar())
        this.sessoes.set(s.id, normalizarSessao(s));
      this.cacheRanking = null;
      this.log.info('Histórico carregado', { sessoes: this.sessoes.size });
    } catch (erro) {
      this.avisar(
        'Não foi possível ler o histórico salvo; as novas sessões continuam sendo registradas.',
      );
      this.log.error('Falha ao carregar histórico', erroParaCtx(erro));
    }
    this.notificar();
  }

  receber(envelope: EnvelopeValido): void {
    if (envelope.tipo === 'diagnostico') {
      this.capturaStats = envelope.dados as Record<string, number>;
      return;
    }
    this.ultimaMensagemEm = envelope.recebidoEm;
    const tipo = this.d.estado.aplicarMensagem(envelope.dados);
    if (tipo === 'batalha') {
      this.rastreador.processarEventos(
        (envelope.dados as { ev: unknown[] }).ev,
        envelope.recebidoEm,
      );
      this.registrarPokemonAtivo();
      this.notificar();
    }
    if (tipo === 'welcome') this.cacheRanking = null;
  }

  private carimbarDiaSazonal() {
    const fim = this.d.estado.fimDiaSazonal;
    if (this.diaCarimbado === fim || fim === null) return;
    this.diaCarimbado = fim;
    const p = this.d.estado.parametrosCombate;
    for (const s of this.sessoes.values()) {
      if (s.sazonal || s.inicio < fim - DIA_MS || s.inicio >= fim) continue;
      const carimbada = { ...s, sazonal: { tipo: p.tipoSazonal, escudo: p.escudoSazonal } };
      this.sessoes.set(s.id, carimbada);
      this.d.repositorio.salvar(carimbada).catch((erro: unknown) =>
        this.log.warn('Falha ao gravar o dia sazonal na sessão', {
          id: s.id,
          ...erroParaCtx(erro),
        }),
      );
    }
  }

  private aoMudarEstado() {
    this.carimbarDiaSazonal();
    const j = this.d.estado.jogador();
    if (j) {
      const slug = j.noCentro ? null : j.huntSlug;
      this.rastreador.definirHunt(slug, undefined, this.ultimaMensagemEm ?? undefined);
      this.registrarPokemonAtivo();
    }
    this.cacheRanking = null;
    this.notificar();
  }

  private registrarPokemonAtivo() {
    const p = this.d.estado.parametrosCombate;
    this.rastreador.registrarSazonal({ tipo: p.tipoSazonal, escudo: p.escudoSazonal });
    const pk = this.d.estado.pokemonAtivo();
    if (!pk) return;
    if (!this.ativosLogados.has(String(pk.id))) {
      this.ativosLogados.add(String(pk.id));
      this.log.info(
        'Dados de combate do ativo',
        dadosDeCombate(pk, this.d.especies.obter(pk.speciesId)),
      );
    }
    this.rastreador.registrarPokemon({
      id: String(pk.id),
      ...(pk.speciesId !== undefined ? { speciesId: pk.speciesId } : {}),
      ...(pk.level !== undefined ? { level: pk.level } : {}),
    });
  }

  private salvarSessao(s: Sessao) {
    this.sessoes.set(s.id, s);
    this.cacheRanking = null;
    if (!s.aberta) {
      this.logarResumo(s);
      this.d.aoFecharSessao?.();
    }
    this.d.repositorio.salvar(s).catch((erro: unknown) => {
      this.avisar('Falha ao salvar uma sessão no navegador. Exporte seus dados por segurança.');
      this.log.error('Falha ao persistir sessão', { id: s.id, ...erroParaCtx(erro) });
    });
  }

  private logarResumo(s: Sessao) {
    try {
      const estado = this.d.estado;
      const hunt = estado.huntPorSlug(s.huntSlug);
      const agora = (this.d.agora ?? Date.now)();
      const calibracao = this.simulacao.calibracao([...this.sessoes.values()]);
      const pk = s.pokemon
        ? {
            ...(estado.jogador()?.pokemons.find((p) => String(p.id) === s.pokemon?.id) ?? {
              id: s.pokemon.id,
            }),
            ...(s.pokemon.speciesId !== undefined ? { speciesId: s.pokemon.speciesId } : {}),
            ...(s.pokemon.level !== undefined
              ? {
                  level: Math.round(
                    (s.pokemon.level + (s.pokemon.levelFinal ?? s.pokemon.level)) / 2,
                  ),
                }
              : {}),
            stats: undefined,
            maxHp: undefined,
          }
        : null;
      const simulado =
        pk && hunt ? (this.simulacao.simuladorPara(pk, calibracao?.ajustes)?.(hunt) ?? null) : null;
      this.log.info(
        'Resumo da sessão',
        montarResumoSessao({
          sessao: s,
          huntNivel: hunt?.nivel ?? null,
          especie: this.d.especies.obter(s.pokemon?.speciesId),
          taxas: taxasDe(s, this.precos()),
          simulado,
          calibracao,
          parametros: estado.parametrosCombate,
          multiplicadores: calcularMultiplicadores({ agora, ...estado.bonus(agora) }),
        }),
      );
    } catch (erro) {
      this.log.error('Falha ao montar o resumo da sessão', erroParaCtx(erro));
    }
  }

  checkpoint(): void {
    this.rastreador.checkpoint();
  }

  definirVersaoJogo(versao: string | null): void {
    this.versaoJogo = versao;
    if (versao === null) {
      this.log.warn('Versão do jogo não identificada na página', {
        validada: VERSAO_JOGO_VALIDADA,
      });
    } else if (versao !== VERSAO_JOGO_VALIDADA) {
      this.log.warn('Jogo em versão diferente da validada', {
        versaoJogo: versao,
        validada: VERSAO_JOGO_VALIDADA,
      });
      this.avisos.add(
        `O jogo foi atualizado (${versao}); o helper foi conferido na ${VERSAO_JOGO_VALIDADA}. Se algum número parecer errado, exporte os logs em Opções.`,
      );
    } else {
      this.log.info('Versão do jogo confere com a validada', { versaoJogo: versao });
    }
    this.notificar();
  }

  precos(): Precos {
    return {
      bola: (id) => this.d.estado.bolas.get(id)?.priceGold ?? 0,
      item: (id) =>
        this.d.itens.obter(id)?.npcPrice ?? this.d.estado.itensJogo.get(id)?.npcPrice ?? 0,
    };
  }

  melhoresHuntsPara(pokemonId: string, criterio: 'xp' | 'gold', limite = 10) {
    const estado = this.d.estado;
    const pk = estado.jogador()?.pokemons.find((p) => String(p.id) === pokemonId);
    if (!pk) return [];
    const agora = (this.d.agora ?? Date.now)();
    const nivelTreinador = estado.jogador()?.level;
    return this.simulacao.melhoresHunts(
      pk,
      estado.hunts.filter((h) => nivelTreinador === undefined || h.nivel <= nivelTreinador),
      criterio,
      limite,
      this.cacheRanking?.calibracao ?? this.simulacao.calibracao([...this.sessoes.values()]),
      calcularMultiplicadores({ agora, ...estado.bonus(agora) }),
    );
  }

  private referenciaDaHunt(slug: string, idAtual: string, precos: Precos): ReferenciaHunt {
    const nivelTreinador = this.d.estado.jogador()?.level;
    const outras = (this.cacheRanking?.linhas ?? []).filter(
      (l) => l.slug !== slug && (nivelTreinador === undefined || l.nivel <= nivelTreinador),
    );
    const anteriores = [...this.sessoes.values()].filter(
      (s) => s.huntSlug === slug && s.id !== idAtual && s.msAtivo > 0,
    );
    const t = anteriores.length ? taxasDe(agregar(anteriores), precos) : null;
    return {
      outras: {
        xp: outras.map((l) => l.xpH),
        lucro: outras.map((l) => l.lucroH ?? l.goldH),
        gold: outras.map((l) => l.goldH),
        abates: outras.map((l) => l.abatesH),
      },
      historico: t
        ? { xp: t.xpPokemonH, lucro: t.lucroLiquidoH, gold: t.goldH, abates: t.abatesH }
        : null,
    };
  }

  private sessaoAoVivo(): Sessao | null {
    return this.rastreador.sessaoAoVivo((this.d.agora ?? Date.now)());
  }

  private montarEconomiaAtual(): Economia | null {
    const estado = this.d.estado;
    const jogador = estado.jogador();
    const atual = this.sessaoAoVivo();
    const hunt = estado.huntPorSlug(atual?.huntSlug ?? jogador?.huntSlug);
    if (!hunt || !jogador) return null;
    const taxas = atual && atual.msAtivo >= AMOSTRA_RITMO_MS ? taxasDe(atual, this.precos()) : null;
    const ativoId = jogador.activeId;
    const simulado = this.cacheTime?.linhas.find((l) => String(l.pokemon.id) === ativoId);
    const idFragmento = this.d.itens.porNome(NOME_FRAGMENTO_OVO)?.id;
    const economia = montarEconomia({
      hunt,
      todasHunts: estado.hunts,
      especies: this.d.especies,
      bolas: [...estado.bolas.values()],
      inventarioBolas: jogador.bolas,
      captura: estado.captura,
      chanceShiny: estado.chanceShiny,
      abatesH: taxas?.abatesH ?? simulado?.abatesH ?? 0,
      fonteRitmo: taxas ? 'sessao' : simulado ? 'simulado' : 'nenhum',
      sessao: atual
        ? {
            capturas: atual.capturas,
            fugas: atual.fugas,
            bolasUsadas: Object.values(atual.bolas).reduce((a, b) => a + b, 0),
            msAtivo: atual.msAtivo,
          }
        : null,
      fragmentosOvo: idFragmento !== undefined ? (jogador.itens[String(idFragmento)] ?? 0) : 0,
    });
    const calibracao = this.calibracaoCaptura(atual);
    const fator = calibracao.fator.fator;
    const chancesNaHunt: ChanceDaBola[] = [...estado.bolas.values()]
      .filter((b) => (b.catchRate ?? 0) > 0)
      .map((b) => ({
        bolaId: b.id,
        nome: b.name ?? b.nome ?? `Bola ${b.id}`,
        preco: b.priceGold ?? 0,
        ...calibrarChance(
          chanceMediaDaBola(economia.capturas, b.id),
          calibracao.amostras.find((a) => a.huntSlug === hunt.slug && a.bolaId === b.id),
          fator,
        ),
      }));
    const comCalibracao = { ...economia, chancesNaHunt, fatorCaptura: calibracao.fator };
    return { ...comCalibracao, autocatch: this.autocatchDaHunt(hunt, atual, comCalibracao) };
  }

  private formulaDeCaptura(slug: string, bolaId: number): number | null {
    const estado = this.d.estado;
    if (this.cacheFormulaCaptura.hunts !== estado.hunts)
      this.cacheFormulaCaptura = { hunts: estado.hunts, valores: new Map() };
    const chave = `${slug}|${bolaId}`;
    const valores = this.cacheFormulaCaptura.valores;
    if (!valores.has(chave)) {
      const hunt = estado.huntPorSlug(slug);
      valores.set(
        chave,
        hunt
          ? chanceMediaDaBola(
              analisarCaptura(
                hunt,
                this.d.especies,
                [...estado.bolas.values()],
                estado.captura,
                estado.hunts,
              ),
              bolaId,
            )
          : null,
      );
    }
    return valores.get(chave) ?? null;
  }

  private calibracaoCaptura(atual: Sessao | null) {
    const sessoes = [...this.sessoes.values()].filter((s) => s.id !== atual?.id);
    if (atual) sessoes.push(atual);
    const amostras = amostrasDeCaptura(sessoes);
    return { amostras, fator: fatorGlobalCaptura(amostras, (h, b) => this.formulaDeCaptura(h, b)) };
  }

  private autocatchDaHunt(
    hunt: Hunt,
    atual: Sessao | null,
    economia: Economia,
  ): AnaliseAutocatch | null {
    const estado = this.d.estado;
    const jogador = estado.jogador();
    const ativo = estado.pokemonAtivo();
    const sessoes = [...this.sessoes.values()].filter(
      (s) => s.huntSlug === hunt.slug && s.id !== atual?.id,
    );
    if (atual?.huntSlug === hunt.slug) sessoes.push(atual);
    const curva = ativo ? this.curvaDaHunt(hunt, ativo, atual, jogador?.level) : null;
    const abatesHSem = curva?.projecao.atual.abatesH ?? economia.abatesH;
    if (!(abatesHSem > 0)) return null;
    const agora = (this.d.agora ?? Date.now)();
    const mult = calcularMultiplicadores({ agora, ...estado.bonus(agora) });
    const usadas = new Map<number, number>();
    for (const s of sessoes)
      for (const [id, q] of Object.entries(s.bolas))
        usadas.set(Number(id), (usadas.get(Number(id)) ?? 0) + q);
    const maisUsada = [...usadas].toSorted((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const precos = this.precos();
    return analisarAutocatch({
      sessoes,
      precoBola: precos.bola,
      xpPorAbate: curva?.curva.xpPorAbate ?? xpDoNivel(hunt.nivel) * mult.xpPokemon,
      ouroPorAbate: curva?.curva.ouroPorAbate ?? ouroPorAbate(hunt.nivel, mult.bonusLootPct),
      abatesHSem,
      chanceCalibrada:
        economia.chancesNaHunt.find((c) => c.bolaId === maisUsada)?.calibrada ??
        chanceMediaDaBola(economia.capturas, maisUsada),
      pokemonId: ativo ? String(ativo.id) : undefined,
    });
  }

  private montarProgresso(): ModeloProgresso | null {
    const estado = this.d.estado;
    const jogador = estado.jogador();
    if (!jogador) return null;
    const ativo = estado.pokemonAtivo() ?? null;
    const atual = this.sessaoAoVivo();
    const taxas = atual && atual.msAtivo >= AMOSTRA_RITMO_MS ? taxasDe(atual, this.precos()) : null;
    const simulado = this.cacheTime?.linhas.find(
      (l) => ativo && String(l.pokemon.id) === String(ativo.id),
    );
    const ritmo = taxas ? 'sessao' : simulado ? 'simulado' : 'nenhum';
    const hunt = estado.huntPorSlug(atual?.huntSlug ?? jogador.huntSlug);
    const ritmos = this.ritmosDeXp(hunt, taxas?.abatesH ?? simulado?.abatesH ?? 0, {
      xpTreinador: taxas?.xpTreinadorH ?? simulado?.xpTreinadorH ?? 0,
      xpPokemon: taxas?.xpPokemonH ?? simulado?.xpPokemonH ?? 0,
    });
    const xpTreinadorH = xpHAgora(ritmos.treinador);
    const xpPokemonH = xpHAgora(ritmos.pokemon);
    const especie = this.d.especies.obter(ativo?.speciesId);
    const xpPorAbate = ritmos.bonus.xpBasePorAbate * ritmos.mult.xpPokemon;
    return {
      treinador: { level: jogador.level ?? null, xp: jogador.xp ?? null, xpH: xpTreinadorH },
      ativo: ativo
        ? {
            pokemon: ativo,
            xpH: xpPokemonH,
            evolucao: especie
              ? progressoEvolucao(ativo, especie, xpPorAbate, ritmos.pokemon)
              : null,
            refino: Object.entries(ativo.refino ?? {}).map(([stat, pontos]) => ({
              stat,
              pontos,
              proximo: custoRefino(pontos).proximo,
            })),
          }
        : null,
      travados: pokemonsTravados(jogador.pokemons, jogador, ritmos.treinador),
      ritmo,
      ritmoTreinador: ritmos.treinador,
      ritmoPokemon: ritmos.pokemon,
      bonus: { agora: ritmos.agora, ativos: ritmos.mult.ativos },
      curvaNivel: ativo && hunt ? this.curvaDaHunt(hunt, ativo, atual, jogador.level) : null,
    };
  }

  private curvaDaHunt(
    hunt: Hunt,
    ativo: PokemonJogador,
    atual: Sessao | null,
    nivelTreinador: number | undefined,
  ): CurvaDaHunt | null {
    if (ativo.level === undefined) return null;
    const tipoSazonal = this.d.estado.parametrosCombate.tipoSazonal ?? null;
    const trechos = trechosDaHunt(this.sessoes.values(), atual, {
      huntSlug: hunt.slug,
      pokemonId: String(ativo.id),
      tipoSazonal,
    });
    const ajustada = ajustarCurvaNivel(trechos);
    if (!ajustada) return null;
    const { bonus, mult } = this.ritmosDeXp(hunt, 0, { xpTreinador: 0, xpPokemon: 0 });
    const curva = { ...ajustada, xpPorAbate: bonus.xpBasePorAbate * mult.xpPokemon };
    const limite = nivelTreinador !== undefined ? nivelTreinador + FOLGA_NIVEL_POKEMON : null;
    return {
      huntNome: hunt.nome || hunt.slug,
      tipoSazonal,
      curva,
      projecao: projetarProgressao(curva, { nivel: ativo.level, xp: ativo.xp }, limite, bonus),
      bonus,
    };
  }

  private ritmosDeXp(
    hunt: Hunt | undefined,
    abatesH: number,
    medido: Record<QuemGanhaXp, number>,
  ): RitmosDeXp {
    const agora = (this.d.agora ?? Date.now)();
    const entrada = { agora, ...this.d.estado.bonus(agora) };
    const mult = calcularMultiplicadores(entrada);
    const faixas = faixasDeBonus(entrada);
    const xpBasePorAbate = hunt ? xpDoNivel(hunt.nivel) : 0;
    const xpHBase = abatesH > 0 ? abatesH * xpBasePorAbate : 0;
    const ritmo = (quem: QuemGanhaXp): RitmoXp =>
      xpHBase > 0
        ? { xpHBase, faixas, quem }
        : { xpHBase: Math.max(0, medido[quem]), faixas: [FAIXA_NEUTRA], quem };
    return {
      agora,
      mult,
      bonus: { xpBasePorAbate, faixas },
      treinador: ritmo('xpTreinador'),
      pokemon: ritmo('xpPokemon'),
    };
  }

  private recalcularAnalises(precos: Precos): void {
    const estado = this.d.estado;
    const jogador = estado.jogador();
    const ativo = estado.pokemonAtivo();
    const agora = (this.d.agora ?? Date.now)();
    const sessoes = [...this.sessoes.values()];
    const entradaBonus = { agora, ...estado.bonus(agora) };
    const multiplicadores = calcularMultiplicadores(entradaBonus);
    this.analisesValidasAte = agora + (faixasDeBonus(entradaBonus)[0]?.horas ?? Infinity) * MS_HORA;
    const calibracao = this.simulacao.calibracao(sessoes);
    const simular = ativo ? this.simulacao.simuladorPara(ativo, calibracao?.ajustes) : null;
    this.cacheRanking = montarRanking({
      hunts: estado.hunts,
      sessoes,
      catalogo: this.d.especies,
      tabela: estado.tabelaTipos,
      ...(ativo ? { ativo } : {}),
      time: jogador?.pokemons ?? [],
      precos,
      amostraMinimaMs: this.d.config.amostraMinimaMs,
      multiplicadores,
      ...(simular ? { simular } : {}),
      calibracao,
    });
    const slug = this.rastreador.sessaoAtual?.huntSlug ?? jogador?.huntSlug ?? null;
    const hunt = estado.huntPorSlug(slug);
    this.cacheTime =
      hunt && jogador
        ? {
            huntNome: hunt.nome || hunt.slug,
            huntNivel: hunt.nivel,
            ativoId: jogador.activeId ?? null,
            linhas: this.simulacao.analisarTime(
              hunt,
              this.simulacao.equipe(jogador),
              calibracao,
              multiplicadores,
            ),
            calibracao,
          }
        : null;
  }

  modelo(): Modelo {
    const estado = this.d.estado;
    const jogador = estado.jogador();
    const ativo = estado.pokemonAtivo() ?? null;
    const precos = this.precos();
    const atual = this.sessaoAoVivo();
    if ((this.d.agora ?? Date.now)() >= this.analisesValidasAte) this.cacheRanking = null;
    if (estado.recebeuWelcome && !this.cacheRanking) this.recalcularAnalises(precos);
    const melhorSimulado = this.cacheTime?.linhas[0]?.pokemon ?? null;
    let sessao: ModeloSessao | null = null;
    if (atual) {
      const hunt = estado.huntPorSlug(atual.huntSlug);
      const tipo = hunt
        ? avaliarHunt(
            hunt,
            tiposDoPokemon(ativo ?? undefined, this.d.especies),
            this.d.especies,
            estado.tabelaTipos,
          )
        : null;
      const sugestao = hunt
        ? melhorDoTime(hunt, jogador?.pokemons ?? [], this.d.especies, estado.tabelaTipos)
        : null;
      const consumidos = (
        mapa: Record<string, number>,
        preco: (id: number) => number,
        rotulo: (id: string) => string,
      ) =>
        Object.entries(mapa).map(([id, qtd]) => ({
          nome: rotulo(id),
          qtd,
          custo: preco(Number(id)) * qtd,
        }));
      const taxas = taxasDe(atual, precos);
      const ritmos = this.ritmosDeXp(hunt, taxas.abatesH, {
        xpTreinador: taxas.xpTreinadorH,
        xpPokemon: taxas.xpPokemonH,
      });
      sessao = {
        huntSlug: atual.huntSlug,
        huntNome: atual.huntNome,
        taxas,
        abates: atual.abates,
        capturas: atual.capturas,
        fugas: atual.fugas,
        desmaios: atual.desmaios,
        xpPerdido: atual.xpPerdido,
        metas: {
          treinador: previsaoDeNivel(jogador ?? undefined, ritmos.treinador),
          pokemon: previsaoDeNivel(ativo ?? undefined, ritmos.pokemon),
        },
        consumidos: [
          ...consumidos(atual.pocoes, precos.item, (id) => this.d.itens.nome(id)),
          ...consumidos(atual.revives, precos.item, (id) => this.d.itens.nome(id)),
          ...consumidos(
            atual.bolas,
            precos.bola,
            (id) => estado.bolas.get(Number(id))?.name ?? `Bola ${id}`,
          ),
        ],
        drops: Object.entries(atual.drops)
          .map(([chave, d]) => ({
            nome: d.nome ?? this.d.itens.nome(chave),
            qtd: d.qtd,
            aCadaAbates: d.qtd > 0 ? atual.abates / d.qtd : null,
          }))
          .toSorted((a, b) => b.qtd - a.qtd),
        autonomia: calcularAutonomia({
          msAtivo: atual.msAtivo,
          consumo: atual,
          estoque: { itens: jogador?.itens ?? {}, bolas: jogador?.bolas ?? {} },
          nome: (categoria, id) =>
            categoria === 'bola'
              ? (estado.bolas.get(Number(id))?.name ?? `Bola ${id}`)
              : this.d.itens.nome(id),
        }),
        tipo,
        dano: avaliarDanoRecebido(atual),
        referencia: this.referenciaDaHunt(atual.huntSlug, atual.id, precos),
        fases: atual.fases,
        golpesDados: atual.golpesDados,
        danoCausado: atual.danoCausado,
        sugestao: this.cacheTime?.linhas.length
          ? melhorSimulado && ativo && String(melhorSimulado.id) !== String(ativo.id)
            ? melhorSimulado
            : null
          : sugestao &&
              ativo &&
              hunt &&
              String(sugestao.pokemon.id) !== String(ativo.id) &&
              sugestao.pontuacao > (tipo ? (pontuarParaHunt(tipo, ativo.level, hunt) ?? 0) : 0)
            ? sugestao.pokemon
            : null,
        ativo,
      };
    }
    return {
      status: estado.recebeuWelcome ? 'pronto' : 'aguardando-login',
      time: estado.recebeuWelcome ? this.cacheTime : null,
      progresso: estado.recebeuWelcome ? this.montarProgresso() : null,
      economia: estado.recebeuWelcome ? this.montarEconomiaAtual() : null,
      sessao,
      ranking: estado.recebeuWelcome ? this.cacheRanking : null,
      nivelAtivo: ativo?.level ?? null,
      avisos: [...this.avisos],
      diagnostico: {
        versao: this.d.versao,
        versaoJogo: this.versaoJogo,
        welcome: estado.recebeuWelcome,
        especies: this.d.especies.tamanho,
        sessoesSalvas: this.sessoes.size,
        eventosInvalidos: this.rastreador.eventosInvalidos,
        captura: this.capturaStats,
        ultimaMensagemEm: this.ultimaMensagemEm,
        dadosAtivo: ativo
          ? {
              ivs: !!ativo.ivs,
              qualidade: ativo.quality !== undefined,
              stats: !!ativo.stats,
              golpes: this.d.especies.obter(ativo.speciesId)?.golpes.length ?? 0,
            }
          : null,
      },
    };
  }

  historico(filtroSlug?: string, limite?: number): Historico {
    return montarHistorico([...this.sessoes.values()], this.precos(), filtroSlug, limite);
  }

  async importarSessoes(json: unknown): Promise<ResultadoImportacao> {
    const leitura = lerBackup(json);
    if (!leitura.formatoValido)
      return { formatoValido: false, novas: 0, atualizadas: 0, mantidas: 0, invalidas: 0 };
    const antes = new Map(this.sessoes);
    const r = mesclarSessoes(this.sessoes, leitura.sessoes);
    const mudaram = [...this.sessoes.values()].filter((s) => antes.get(s.id) !== s);
    for (const s of mudaram) await this.d.repositorio.salvar(s);
    this.cacheRanking = null;
    this.log.info('Backup importado', { ...r, invalidas: leitura.invalidas });
    this.notificar();
    return { formatoValido: true, ...r, invalidas: leitura.invalidas };
  }

  backupCompleto(): Backup {
    return montarBackup(
      [...this.sessoes.values()].toSorted((a, b) => a.inicio - b.inicio),
      this.d.versao,
      (this.d.agora ?? Date.now)(),
    );
  }

  exportarDados(): { versao: string; exportadoEm: number; sessoes: Sessao[] } {
    return {
      versao: this.d.versao,
      exportadoEm: (this.d.agora ?? Date.now)(),
      sessoes: [...this.sessoes.values()],
    };
  }

  async limparHistorico(): Promise<void> {
    await this.d.repositorio.limpar();
    this.sessoes.clear();
    this.cacheRanking = null;
    this.log.info('Histórico apagado pelo usuário');
    this.notificar();
  }

  avisar(msg: string): void {
    this.avisos.add(msg);
    this.notificar();
  }

  inscrever(fn: () => void): () => void {
    this.ouvintes.add(fn);
    return () => this.ouvintes.delete(fn);
  }

  private notificar() {
    for (const fn of this.ouvintes) {
      try {
        fn();
      } catch (erro) {
        this.log.error('Falha ao atualizar a interface', erroParaCtx(erro));
      }
    }
  }
}
