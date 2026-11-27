import type { EnvelopeValido } from '../bridge/receptor';
import type { CatalogoEspecies, CatalogoItens } from '../domain/catalogo';
import type { EstadoJogo } from '../domain/estadoJogo';
import { RastreadorSessao, normalizarSessao, type Sessao } from '../domain/sessao';
import type { PokemonJogador } from '../domain/schemas';
import {
  avaliarHunt,
  melhorDoTime,
  pontuarParaHunt,
  tiposDoPokemon,
  type AvaliacaoTipo,
} from '../analysis/dicasTipo';
import { calcularAutonomia, type Autonomia } from '../analysis/autonomia';
import { avaliarDanoRecebido, type AvaliacaoDano } from '../analysis/danoRecebido';
import { montarHistorico, type Historico } from '../analysis/historico';
import { previsaoDeNivel, type PrevisaoNivel } from '../analysis/metas';
import { calcularMultiplicadores } from '../analysis/multiplicadores';
import { montarRanking, type ResultadoRanking } from '../analysis/ranking';
import { taxasDe, type Precos, type Taxas } from '../analysis/taxas';
import type { Config } from '../shared/config';
import type { Logger } from '../shared/logger';
import { erroParaCtx } from '../shared/logger';
import { VERSAO_JOGO_VALIDADA } from '../shared/protocolo';
import type { Calibracao } from '../analysis/calibracao';
import { ServicoSimulacao, type AnaliseDoPokemon } from './servicoSimulacao';
import { xpDoNivel } from '../analysis/formulasJogo';
import { montarEconomia, type Economia } from './servicoEconomia';
import {
  custoRefino,
  pokemonsTravados,
  progressoEvolucao,
  type PokemonTravado,
  type ProgressoEvolucao,
} from '../analysis/progressao';

const AMOSTRA_RITMO_MS = 5 * 60_000;
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

  private aoMudarEstado() {
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
    const pk = this.d.estado.pokemonAtivo();
    if (!pk) return;
    this.rastreador.registrarPokemon({
      id: String(pk.id),
      ...(pk.speciesId !== undefined ? { speciesId: pk.speciesId } : {}),
      ...(pk.level !== undefined ? { level: pk.level } : {}),
    });
  }

  private salvarSessao(s: Sessao) {
    this.sessoes.set(s.id, s);
    this.cacheRanking = null;
    this.d.repositorio.salvar(s).catch((erro: unknown) => {
      this.avisar('Falha ao salvar uma sessão no navegador. Exporte seus dados por segurança.');
      this.log.error('Falha ao persistir sessão', { id: s.id, ...erroParaCtx(erro) });
    });
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
    return this.simulacao.melhoresHunts(
      pk,
      estado.hunts,
      criterio,
      limite,
      this.cacheRanking?.calibracao ?? this.simulacao.calibracao([...this.sessoes.values()]),
      calcularMultiplicadores({ agora, ...estado.bonus(agora) }),
    );
  }

  private montarEconomiaAtual(): Economia | null {
    const estado = this.d.estado;
    const jogador = estado.jogador();
    const atual = this.rastreador.sessaoAtual;
    const hunt = estado.huntPorSlug(atual?.huntSlug ?? jogador?.huntSlug);
    if (!hunt || !jogador) return null;
    const taxas = atual && atual.msAtivo >= AMOSTRA_RITMO_MS ? taxasDe(atual, this.precos()) : null;
    const ativoId = jogador.activeId;
    const simulado = this.cacheTime?.linhas.find((l) => String(l.pokemon.id) === ativoId);
    const idFragmento = this.d.itens.porNome(NOME_FRAGMENTO_OVO)?.id;
    return montarEconomia({
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
  }

  private montarProgresso(): ModeloProgresso | null {
    const estado = this.d.estado;
    const jogador = estado.jogador();
    if (!jogador) return null;
    const ativo = estado.pokemonAtivo() ?? null;
    const atual = this.rastreador.sessaoAtual;
    const taxas = atual && atual.msAtivo >= AMOSTRA_RITMO_MS ? taxasDe(atual, this.precos()) : null;
    const simulado = this.cacheTime?.linhas.find(
      (l) => ativo && String(l.pokemon.id) === String(ativo.id),
    );
    const ritmo = taxas ? 'sessao' : simulado ? 'simulado' : 'nenhum';
    const xpTreinadorH = taxas?.xpTreinadorH ?? simulado?.xpTreinadorH ?? 0;
    const xpPokemonH = taxas?.xpPokemonH ?? simulado?.xpPokemonH ?? 0;
    const hunt = estado.huntPorSlug(atual?.huntSlug ?? jogador.huntSlug);
    const especie = this.d.especies.obter(ativo?.speciesId);
    const agora = (this.d.agora ?? Date.now)();
    const xpPorAbate = hunt
      ? xpDoNivel(hunt.nivel) * calcularMultiplicadores({ agora, ...estado.bonus(agora) }).xpPokemon
      : 0;
    return {
      treinador: { level: jogador.level ?? null, xp: jogador.xp ?? null, xpH: xpTreinadorH },
      ativo: ativo
        ? {
            pokemon: ativo,
            xpH: xpPokemonH,
            evolucao: especie ? progressoEvolucao(ativo, especie, xpPorAbate, xpPokemonH) : null,
            refino: Object.entries(ativo.refino ?? {}).map(([stat, pontos]) => ({
              stat,
              pontos,
              proximo: custoRefino(pontos).proximo,
            })),
          }
        : null,
      travados: pokemonsTravados(jogador.pokemons, jogador, xpTreinadorH),
      ritmo,
    };
  }

  private recalcularAnalises(precos: Precos): void {
    const estado = this.d.estado;
    const jogador = estado.jogador();
    const ativo = estado.pokemonAtivo();
    const agora = (this.d.agora ?? Date.now)();
    const sessoes = [...this.sessoes.values()];
    const multiplicadores = calcularMultiplicadores({ agora, ...estado.bonus(agora) });
    const calibracao = this.simulacao.calibracao(sessoes);
    const simular = ativo ? this.simulacao.simuladorPara(ativo) : null;
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
    const atual = this.rastreador.sessaoAtual;
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
          treinador: previsaoDeNivel(jogador ?? undefined, taxas.xpTreinadorH),
          pokemon: previsaoDeNivel(ativo ?? undefined, taxas.xpPokemonH),
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

  historico(filtroSlug?: string): Historico {
    return montarHistorico([...this.sessoes.values()], this.precos(), filtroSlug);
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
