import type { Jogador } from '../../domain/estadoJogo';
import type { EnvelopeComando, ResultadoComando } from '../../shared/comandos';
import type { Logger } from '../../shared/logger';
import type { PreferenciasAutomacao, RegraReposicao } from '../../shared/preferenciasAutomacao';
import { AutoBallDex } from './autoBallDex';
import { CapturaCaidos, type RaizDom } from './capturaCaidos';
import type { ContextoAutomacao } from './contexto';
import { Emissor, type RegistroComando } from './emissor';
import { MelhorAtivo } from './melhorAtivo';
import { Reposicao } from './reposicao';
import { Rotacao, type CandidataRotacao } from './rotacao';
import { Viagem, type ResultadoViagem, type StatusViagem } from './viagem';

export interface DependenciasAutomacao {
  preferencias: () => PreferenciasAutomacao;
  jogador: () => Jogador | null;
  postar: (envelope: EnvelopeComando) => void;
  preco: (kind: RegraReposicao['kind'], id: number) => number | undefined;
  melhorDaHunt: (slug: string) => string | null;
  candidatasRotacao: () => readonly CandidataRotacao[];
  especiePorNome: (nome: string) => number | undefined;
  dom: RaizDom;
  agora?: () => number;
  log: Logger;
}

export interface ModeloAutomacao {
  ligada: boolean;
  vip: boolean;
  viagem: StatusViagem | null;
  ultimaViagem: ResultadoViagem | null;
  comandos: readonly RegistroComando[];
}

export class ServicoAutomacao {
  private readonly ctx: ContextoAutomacao;
  readonly emissor: Emissor;
  private readonly viagem: Viagem;
  private readonly autoBall: AutoBallDex;
  private readonly caidos: CapturaCaidos;
  private readonly reposicao: Reposicao;
  private readonly melhorAtivo: MelhorAtivo;
  private readonly rotacao: Rotacao;

  constructor(private readonly d: DependenciasAutomacao) {
    const agora = d.agora ?? Date.now;
    const p = () => d.preferencias();
    this.emissor = new Emissor({ postar: d.postar, ligado: () => p().ligada, agora, log: d.log });
    this.ctx = {
      agora,
      jogador: d.jogador,
      enviar: (c, origem) => this.emissor.enviar(c, origem),
      log: d.log,
    };
    this.viagem = new Viagem(this.ctx);
    this.autoBall = new AutoBallDex(this.ctx);
    this.caidos = new CapturaCaidos(this.ctx, d.dom, d.especiePorNome);
    this.reposicao = new Reposicao(this.ctx, {
      regras: () => p().reposicao.regras,
      reservaGold: () => p().reposicao.reservaGold,
      preco: d.preco,
    });
    this.melhorAtivo = new MelhorAtivo(this.ctx, d.melhorDaHunt);
    this.rotacao = new Rotacao(this.ctx, {
      criterio: () => p().rotacao.criterio,
      candidatas: d.candidatasRotacao,
      viajar: (slug) => this.viagem.iniciar(slug),
    });
  }

  viajar(slug: string): boolean {
    const p = this.d.preferencias();
    if (!p.ligada || !p.viagem) return false;
    this.viagem.iniciar(slug);
    return true;
  }

  cancelarViagem(): void {
    this.viagem.cancelar();
  }

  tique(): void {
    const p = this.d.preferencias();
    if (!p.ligada) {
      this.viagem.cancelar();
      this.rotacao.reiniciar();
      return;
    }
    this.viagem.tique();
    if (p.autoBallDex && this.d.jogador()?.vip === false) this.caidos.tique();
    if (p.reposicao.ligada) this.reposicao.tique();
    if (p.melhorAtivo && !this.viagem.status) this.melhorAtivo.tique();
    if (p.rotacao.ligada) this.rotacao.tique();
    else this.rotacao.reiniciar();
  }

  aoEventosBatalha(eventos: readonly unknown[]): void {
    const p = this.d.preferencias();
    if (!p.ligada || !p.autoBallDex) return;
    for (const ev of eventos) {
      if (!ev || typeof ev !== 'object') continue;
      const e = ev as { k?: unknown; speciesId?: unknown };
      const especie = Number(e.speciesId);
      if (e.k === 'spawn' && Number.isInteger(especie) && especie > 0)
        this.autoBall.aoSpawn(especie);
    }
  }

  aoResultado(r: ResultadoComando): void {
    this.emissor.aoResultado(r);
  }

  modelo(): ModeloAutomacao {
    return {
      ligada: this.d.preferencias().ligada,
      vip: this.d.jogador()?.vip ?? false,
      viagem: this.viagem.status,
      ultimaViagem: this.viagem.ultimo,
      comandos: this.emissor.historico(),
    };
  }
}
