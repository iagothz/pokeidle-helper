import * as z from 'zod';

export const PASTA_BACKUP = 'pokeidle-helper';
const MAX_PARTES = 20;
const BLOCO = 0x8000;

export interface ApiDownloads {
  download(opcoes: {
    url: string;
    filename: string;
    conflictAction: 'overwrite';
    saveAs: boolean;
  }): Promise<number>;
}

const esquemaMensagem = z.object({
  tipo: z.literal('backup'),
  partes: z.array(z.string()).min(1).max(MAX_PARTES),
});

export type RespostaBackup = { ok: true; arquivos: string[] } | { ok: false; erro: string };

export function base64Utf8(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let binario = '';
  for (let i = 0; i < bytes.length; i += BLOCO)
    binario += String.fromCharCode(...bytes.subarray(i, i + BLOCO));
  return btoa(binario);
}

export function nomeDaParte(indice: number): string {
  const sufixo = indice === 0 ? '' : `-parte-${indice + 1}`;
  return `${PASTA_BACKUP}/pokeidle-helper-backup${sufixo}.json`;
}

export async function gravarBackup(
  partes: readonly string[],
  downloads: ApiDownloads,
): Promise<string[]> {
  const arquivos: string[] = [];
  for (const [i, texto] of partes.entries()) {
    const filename = nomeDaParte(i);
    await downloads.download({
      url: `data:application/json;base64,${base64Utf8(texto)}`,
      filename,
      conflictAction: 'overwrite',
      saveAs: false,
    });
    arquivos.push(filename);
  }
  return arquivos;
}

export async function tratarMensagem(
  mensagem: unknown,
  remetente: { id?: string | undefined },
  idExtensao: string,
  downloads: ApiDownloads,
): Promise<RespostaBackup> {
  if (remetente.id !== idExtensao) return { ok: false, erro: 'origem não autorizada' };
  const res = esquemaMensagem.safeParse(mensagem);
  if (!res.success) return { ok: false, erro: 'mensagem inválida' };
  try {
    return { ok: true, arquivos: await gravarBackup(res.data.partes, downloads) };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : String(erro) };
  }
}
