import { describe, expect, it, vi } from 'vitest';
import {
  PASTA_BACKUP,
  base64Utf8,
  gravarBackup,
  nomeDaParte,
  tratarMensagem,
} from '../../src/background/gravadorBackup';

function downloadsFalso() {
  return { download: vi.fn(async (_o: { url: string; filename: string }) => 1) };
}

describe('base64Utf8', () => {
  it('codifica UTF-8 com acentos de forma reversível', () => {
    const texto = '{"huntNome":"Pokémon Ação ✓"}';
    const b64 = base64Utf8(texto);
    expect(new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))).toBe(
      texto,
    );
  });
});

describe('gravarBackup', () => {
  it('grava cada parte sobrescrevendo na pasta do helper', async () => {
    const d = downloadsFalso();
    const r = await gravarBackup(['{"a":1}', '{"b":2}'], d);
    expect(r).toEqual([nomeDaParte(0), nomeDaParte(1)]);
    expect(nomeDaParte(0)).toBe(`${PASTA_BACKUP}/pokeidle-helper-backup.json`);
    expect(nomeDaParte(1)).toBe(`${PASTA_BACKUP}/pokeidle-helper-backup-parte-2.json`);
    expect(d.download).toHaveBeenCalledWith({
      url: `data:application/json;base64,${base64Utf8('{"a":1}')}`,
      filename: nomeDaParte(0),
      conflictAction: 'overwrite',
      saveAs: false,
    });
  });
});

describe('gravarBackup silencioso', () => {
  function downloadsCompleto(estados: string[] = ['complete']) {
    const chamadas: string[] = [];
    let proximoId = 10;
    const fila = [...estados];
    return {
      chamadas,
      download: vi.fn(async (o: { filename: string }) => {
        chamadas.push(`download ${o.filename}`);
        return proximoId++;
      }),
      search: vi.fn(async ({ id }: { id: number }) => [
        { id, state: fila.length > 1 ? fila.shift()! : fila[0]! },
      ]),
      erase: vi.fn(async ({ id }: { id: number }) => {
        chamadas.push(`erase ${id}`);
        return [id];
      }),
      setUiOptions: vi.fn(async ({ enabled }: { enabled: boolean }) => {
        chamadas.push(`ui ${enabled}`);
      }),
    };
  }
  const semEspera = async () => {};

  it('esconde a barra de downloads, grava, apaga do histórico e reativa a barra', async () => {
    const d = downloadsCompleto();
    await gravarBackup(['{"a":1}', '{"b":2}'], d, semEspera);
    expect(d.chamadas).toEqual([
      'ui false',
      `download ${nomeDaParte(0)}`,
      `download ${nomeDaParte(1)}`,
      'erase 10',
      'erase 11',
      'ui true',
    ]);
  });

  it('espera o download terminar antes de apagar do histórico', async () => {
    const d = downloadsCompleto(['in_progress', 'in_progress', 'complete']);
    const esperar = vi.fn(async () => {});
    await gravarBackup(['{}'], d, esperar);
    expect(esperar).toHaveBeenCalledTimes(2);
    expect(d.erase).toHaveBeenCalledWith({ id: 10 });
  });

  it('reativa a barra mesmo quando o download falha', async () => {
    const d = downloadsCompleto();
    d.download.mockRejectedValueOnce(new Error('bloqueado'));
    await expect(gravarBackup(['{}'], d, semEspera)).rejects.toThrow('bloqueado');
    expect(d.chamadas).toEqual(['ui false', 'ui true']);
  });

  it('não apaga do histórico um download que não terminou a tempo', async () => {
    const d = downloadsCompleto(['in_progress']);
    await gravarBackup(['{}'], d, semEspera);
    expect(d.erase).not.toHaveBeenCalled();
    expect(d.chamadas.at(-1)).toBe('ui true');
  });
});

describe('tratarMensagem', () => {
  const ID = 'minha-extensao';

  it('aceita só mensagens de backup da própria extensão', async () => {
    const d = downloadsFalso();
    expect(await tratarMensagem({ tipo: 'backup', partes: ['{}'] }, { id: ID }, ID, d)).toEqual({
      ok: true,
      arquivos: [nomeDaParte(0)],
    });
    expect(
      await tratarMensagem({ tipo: 'backup', partes: ['{}'] }, { id: 'outra' }, ID, d),
    ).toEqual({
      ok: false,
      erro: 'origem não autorizada',
    });
    expect(await tratarMensagem({ tipo: 'outro' }, { id: ID }, ID, d)).toEqual({
      ok: false,
      erro: 'mensagem inválida',
    });
    expect(await tratarMensagem({ tipo: 'backup', partes: [] }, { id: ID }, ID, d)).toMatchObject({
      ok: false,
    });
    expect(
      await tratarMensagem({ tipo: 'backup', partes: Array(21).fill('{}') }, { id: ID }, ID, d),
    ).toMatchObject({ ok: false });
  });

  it('devolve o erro quando o download falha', async () => {
    const d = { download: vi.fn(async () => Promise.reject(new Error('bloqueado'))) };
    expect(await tratarMensagem({ tipo: 'backup', partes: ['{}'] }, { id: 'x' }, 'x', d)).toEqual({
      ok: false,
      erro: 'bloqueado',
    });
  });
});
