import type { DestinoLog, EntradaLog } from '../shared/logger';
import type { Banco, RegistroLog } from './banco';

export interface OpcoesDestinoLog {
  maxBytesPorSegmento: number;
  maxSegmentos: number;
}

interface EstadoSegmento {
  segmento: number;
  bytes: number;
}

const CHAVE_META = 'logs.segmento';

export class DestinoLogBanco implements DestinoLog {
  private buffer: EntradaLog[] = [];
  private estado: EstadoSegmento | null = null;
  private gravando: Promise<void> = Promise.resolve();

  constructor(
    private readonly banco: Banco,
    private readonly opcoes: OpcoesDestinoLog,
  ) {}

  gravar(entrada: EntradaLog): void {
    this.buffer.push(entrada);
    if (this.buffer.length > 5000) this.buffer.splice(0, this.buffer.length - 5000);
  }

  descarregar(): Promise<void> {
    this.gravando = this.gravando.then(() => this.descarregarAgora()).catch(() => undefined);
    return this.gravando;
  }

  private async descarregarAgora(): Promise<void> {
    if (this.buffer.length === 0) return;
    const lote = this.buffer;
    this.buffer = [];
    const estado = this.estado ??
      ((await this.banco.get('meta', CHAVE_META)) as EstadoSegmento | undefined) ?? {
        segmento: 1,
        bytes: 0,
      };
    const tx = this.banco.transaction(['logs', 'meta'], 'readwrite');
    const logs = tx.objectStore('logs');
    const segmentosParaApagar: number[] = [];
    for (const entrada of lote) {
      const tamanho = JSON.stringify(entrada).length;
      if (estado.bytes > 0 && estado.bytes + tamanho > this.opcoes.maxBytesPorSegmento) {
        estado.segmento++;
        estado.bytes = 0;
        segmentosParaApagar.push(estado.segmento - this.opcoes.maxSegmentos);
      }
      estado.bytes += tamanho;
      const registro: RegistroLog = { ...entrada, segmento: estado.segmento };
      void logs.add(registro);
    }
    for (const seg of segmentosParaApagar) {
      if (seg < 1) continue;
      let cursor = await logs.index('porSegmento').openCursor(IDBKeyRange.upperBound(seg));
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
    }
    await tx.objectStore('meta').put(estado, CHAVE_META);
    await tx.done;
    this.estado = estado;
  }

  async exportar(): Promise<RegistroLog[]> {
    await this.descarregar();
    return this.banco.getAll('logs');
  }

  async limpar(): Promise<void> {
    this.buffer = [];
    this.estado = { segmento: 1, bytes: 0 };
    const tx = this.banco.transaction(['logs', 'meta'], 'readwrite');
    await tx.objectStore('logs').clear();
    await tx.objectStore('meta').put(this.estado, CHAVE_META);
    await tx.done;
  }
}
