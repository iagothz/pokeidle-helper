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
