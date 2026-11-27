import {
  ORIGEM_COMANDO,
  VERSAO_COMANDO,
  esquemaComando,
  type Comando,
  type EnvelopeComando,
  type ResultadoComando,
} from '../../shared/comandos';
import type { Logger } from '../../shared/logger';

export const MAXIMO_REGISTROS = 20;

export interface RegistroComando {
  id: number;
  em: number;
  t: string;
  resumo: string;
  origem: string;
  situacao: 'enviado' | 'confirmado' | 'recusado';
  motivo?: string;
}

export interface OpcoesEmissor {
  postar: (envelope: EnvelopeComando) => void;
  ligado: () => boolean;
  agora: () => number;
  log: Logger;
}

function resumir(c: Comando): string {
  switch (c.t) {
    case 'hunt.select':
      return c.slug;
    case 'shop.buy':
      return `${c.qty}× ${c.kind} ${c.id}`;
    case 'team.active':
      return String(c.pokemonId);
    case 'auto.set':
      return c.autoBallAteCapturar ? 'bola até capturar' : 'automações';
  }
}

export class Emissor {
  private proximoId = 1;
  private readonly registros: RegistroComando[] = [];

  constructor(private readonly o: OpcoesEmissor) {}

  enviar(comando: Comando, origem: string): boolean {
    if (!this.o.ligado()) return false;
    const valido = esquemaComando.safeParse(comando);
    if (!valido.success) {
      this.o.log.error('Comando fora do esquema não enviado', { t: comando.t, origem });
      return false;
    }
    const id = this.proximoId++;
    const resumo = resumir(valido.data);
    this.o.postar({ origem: ORIGEM_COMANDO, v: VERSAO_COMANDO, id, comando: valido.data });
    this.registros.unshift({
      id,
      em: this.o.agora(),
      t: valido.data.t,
      resumo,
      origem,
      situacao: 'enviado',
    });
    this.registros.length = Math.min(this.registros.length, MAXIMO_REGISTROS);
    this.o.log.info('Comando enviado', { id, t: valido.data.t, resumo, origem });
    return true;
  }

  aoResultado(r: ResultadoComando): void {
    const registro = this.registros.find((x) => x.id === r.id);
    if (registro) {
      registro.situacao = r.enviado ? 'confirmado' : 'recusado';
      if (r.motivo) registro.motivo = r.motivo;
    }
    if (!r.enviado) this.o.log.warn('Comando recusado pela captura', { ...r });
  }

  historico(): readonly RegistroComando[] {
    return this.registros;
  }
}
