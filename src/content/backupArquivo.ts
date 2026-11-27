import type { RespostaBackup } from '../background/gravadorBackup';
import { particionarSessoes, type Backup } from '../domain/backup';
import { erroParaCtx, type Logger } from '../shared/logger';

export const MAX_BYTES_POR_PARTE = 1_400_000;

export interface MensagemBackup {
  tipo: 'backup';
  partes: string[];
}

export function prepararPartes(backup: Backup, maxBytes = MAX_BYTES_POR_PARTE): string[] {
  const grupos = particionarSessoes(backup.sessoes, maxBytes);
  return grupos.map((sessoes, i) =>
    JSON.stringify({ ...backup, parte: i + 1, partes: grupos.length, sessoes }),
  );
}

export async function enviarBackup(
  backup: Backup,
  enviar: (m: MensagemBackup) => Promise<RespostaBackup>,
  log: Logger,
): Promise<RespostaBackup> {
  try {
    const resposta = await enviar({ tipo: 'backup', partes: prepararPartes(backup) });
    if (resposta.ok)
      log.info('Backup gravado', { arquivos: resposta.arquivos, sessoes: backup.sessoes.length });
    else log.warn('Backup recusado', { erro: resposta.erro });
    return resposta;
  } catch (erro) {
    log.warn('Falha ao gravar backup', erroParaCtx(erro));
    return { ok: false, erro: erro instanceof Error ? erro.message : String(erro) };
  }
}

export interface ResumoImportacao {
  formatoValido: boolean;
  novas: number;
  atualizadas: number;
  mantidas: number;
  invalidas: number;
}

export async function importarTextos(
  textos: readonly string[],
  importar: (json: unknown) => Promise<ResumoImportacao>,
): Promise<ResumoImportacao> {
  const total: ResumoImportacao = {
    formatoValido: false,
    novas: 0,
    atualizadas: 0,
    mantidas: 0,
    invalidas: 0,
  };
  for (const texto of textos) {
    let json: unknown;
    try {
      json = JSON.parse(texto);
    } catch {
      total.invalidas++;
      continue;
    }
    const r = await importar(json);
    if (!r.formatoValido) {
      total.invalidas++;
      continue;
    }
    total.formatoValido = true;
    total.novas += r.novas;
    total.atualizadas += r.atualizadas;
    total.mantidas += r.mantidas;
    total.invalidas += r.invalidas;
  }
  return total;
}
