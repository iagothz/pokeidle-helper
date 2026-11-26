import type { EnvelopeValido } from '../bridge/receptor';
import type { CatalogoEspecies, CatalogoItens } from '../domain/catalogo';
import type { EstadoJogo } from '../domain/estadoJogo';
import { RastreadorSessao, type Sessao } from '../domain/sessao';
import type { PokemonJogador } from '../domain/schemas';
import {
  avaliarHunt,
  melhorDoTime,
  tiposDoPokemon,
  type AvaliacaoTipo,
} from '../analysis/dicasTipo';
import { montarRanking, type ResultadoRanking } from '../analysis/ranking';
import { taxasDe, type Precos, type Taxas } from '../analysis/taxas';
import type { Config } from '../shared/config';
import type { Logger } from '../shared/logger';
import { erroParaCtx } from '../shared/logger';
import { VERSAO_JOGO_VALIDADA } from '../shared/protocolo';

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

export interface ModeloSessao {
  huntSlug: string;
  huntNome: string;
  taxas: Taxas;
  abates: number;
  capturas: number;
  consumidos: ItemConsumido[];
  tipo: AvaliacaoTipo | null;
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
}

export interface Modelo {
  status: 'aguardando-login' | 'pronto';
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
  private readonly log: Logger;

  constructor(private readonly d: DependenciasAplicacao) {
    this.log = d.log;
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
      for (const s of await this.d.repositorio.listar()) this.sessoes.set(s.id, s);
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
      this.notificar();
    }
    if (tipo === 'welcome') this.cacheRanking = null;
  }

  private aoMudarEstado() {
    const j = this.d.estado.jogador();
    if (j) {
      const slug = j.noCentro ? null : j.huntSlug;
      this.rastreador.definirHunt(slug, undefined, this.ultimaMensagemEm ?? undefined);
    }
    this.cacheRanking = null;
    this.notificar();
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

  modelo(): Modelo {
    const estado = this.d.estado;
    const jogador = estado.jogador();
    const ativo = estado.pokemonAtivo() ?? null;
    const precos = this.precos();
    const atual = this.rastreador.sessaoAtual;
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
      sessao = {
        huntSlug: atual.huntSlug,
        huntNome: atual.huntNome,
        taxas: taxasDe(atual, precos),
        abates: atual.abates,
        capturas: atual.capturas,
        consumidos: [
          ...consumidos(atual.pocoes, precos.item, (id) => this.d.itens.nome(id)),
          ...consumidos(atual.revives, precos.item, (id) => this.d.itens.nome(id)),
          ...consumidos(
            atual.bolas,
            precos.bola,
            (id) => estado.bolas.get(Number(id))?.name ?? `Bola ${id}`,
          ),
        ],
        tipo,
        sugestao:
          sugestao &&
          ativo &&
          String(sugestao.pokemon.id) !== String(ativo.id) &&
          (sugestao.avaliacao.ofensiva ?? 0) > (tipo?.ofensiva ?? 0)
            ? sugestao.pokemon
            : null,
        ativo,
      };
    }
    if (estado.recebeuWelcome && !this.cacheRanking) {
      this.cacheRanking = montarRanking({
        hunts: estado.hunts,
        sessoes: [...this.sessoes.values()],
        catalogo: this.d.especies,
        tabela: estado.tabelaTipos,
        ...(ativo ? { ativo } : {}),
        time: jogador?.pokemons ?? [],
        precos,
        amostraMinimaMs: this.d.config.amostraMinimaMs,
      });
    }
    return {
      status: estado.recebeuWelcome ? 'pronto' : 'aguardando-login',
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
      },
    };
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
