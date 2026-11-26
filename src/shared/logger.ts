export const NIVEIS = ['DEBUG', 'INFO', 'WARN', 'ERROR'] as const;
export type NivelLog = (typeof NIVEIS)[number];

export interface EntradaLog {
  ts: number;
  nivel: NivelLog;
  modulo: string;
  msg: string;
  ctx?: Record<string, unknown>;
}

export interface DestinoLog {
  gravar(entrada: EntradaLog): void;
}

export interface Logger {
  debug(msg: string, ctx?: Record<string, unknown>): void;
  info(msg: string, ctx?: Record<string, unknown>): void;
  warn(msg: string, ctx?: Record<string, unknown>): void;
  error(msg: string, ctx?: Record<string, unknown>): void;
  filho(modulo: string): Logger;
}

const peso = (n: NivelLog) => NIVEIS.indexOf(n);

export function erroParaCtx(erro: unknown): Record<string, unknown> {
  if (erro instanceof Error)
    return { erro: erro.message, pilha: erro.stack?.split('\n').slice(0, 6).join('\n') };
  return { erro: String(erro) };
}

export class GerenciadorLog {
  private nivel: NivelLog;
  private readonly destinos: DestinoLog[] = [];

  constructor(
    nivel: NivelLog = 'INFO',
    private readonly agora: () => number = Date.now,
  ) {
    this.nivel = nivel;
  }

  definirNivel(nivel: NivelLog): void {
    this.nivel = nivel;
  }

  adicionarDestino(destino: DestinoLog): void {
    this.destinos.push(destino);
  }

  logger(modulo: string): Logger {
    const emitir = (nivel: NivelLog, msg: string, ctx?: Record<string, unknown>) => {
      if (peso(nivel) < peso(this.nivel)) return;
      const entrada: EntradaLog = { ts: this.agora(), nivel, modulo, msg, ...(ctx ? { ctx } : {}) };
      for (const destino of this.destinos) {
        try {
          destino.gravar(entrada);
        } catch {
          continue;
        }
      }
    };
    return {
      debug: (msg, ctx) => emitir('DEBUG', msg, ctx),
      info: (msg, ctx) => emitir('INFO', msg, ctx),
      warn: (msg, ctx) => emitir('WARN', msg, ctx),
      error: (msg, ctx) => emitir('ERROR', msg, ctx),
      filho: (sub) => this.logger(`${modulo}.${sub}`),
    };
  }
}

export class DestinoConsole implements DestinoLog {
  gravar(e: EntradaLog): void {
    const linha = `[PokeIdle Helper] ${new Date(e.ts).toISOString()} ${e.nivel} ${e.modulo}: ${e.msg}`;
    const fn =
      e.nivel === 'ERROR' ? console.error : e.nivel === 'WARN' ? console.warn : console.debug;
    if (e.ctx) fn(linha, e.ctx);
    else fn(linha);
  }
}

export class DestinoMemoria implements DestinoLog {
  readonly entradas: EntradaLog[] = [];
  constructor(private readonly limite = 500) {}
  gravar(e: EntradaLog): void {
    this.entradas.push(e);
    if (this.entradas.length > this.limite)
      this.entradas.splice(0, this.entradas.length - this.limite);
  }
}
