import { describe, expect, it, vi } from 'vitest';
import { enviarBackup, importarTextos, prepararPartes } from '../../src/content/backupArquivo';
import { lerBackup, montarBackup } from '../../src/domain/backup';
import { novaSessao } from '../../src/domain/sessao';
import { logDeTeste } from '../helpers/log';

const sessoes = Array.from({ length: 6 }, (_, i) => ({
  ...novaSessao('bellsprout', 'Bellsprout', i),
  msAtivo: 600_000,
  aberta: false,
}));

describe('prepararPartes', () => {
  it('gera uma parte só quando cabe, com numeração e todas as sessões', () => {
    const [unica, ...resto] = prepararPartes(montarBackup(sessoes, '0.8.0', 1), 1_000_000);
    expect(resto).toEqual([]);
    const json = JSON.parse(unica!);
    expect(json).toMatchObject({ formato: 'pokeidle-helper-backup', parte: 1, partes: 1 });
    expect(lerBackup(json).sessoes).toHaveLength(6);
  });

  it('divide quando passa do limite e cada parte continua importável', () => {
    const tamanho = JSON.stringify(sessoes[0]).length;
    const partes = prepararPartes(montarBackup(sessoes, '0.8.0', 1), tamanho * 2 + 5);
    expect(partes.length).toBe(3);
    const total = partes
      .map((p) => lerBackup(JSON.parse(p)).sessoes.length)
      .reduce((a, b) => a + b);
    expect(total).toBe(6);
    expect(JSON.parse(partes[2]!)).toMatchObject({ parte: 3, partes: 3 });
  });
});

describe('enviarBackup', () => {
  it('envia as partes e registra os arquivos gravados', async () => {
    const { log, memoria } = logDeTeste();
    const enviar = vi.fn(async () => ({ ok: true as const, arquivos: ['pokeidle-helper/x.json'] }));
    const r = await enviarBackup(montarBackup(sessoes, '0.8.0', 1), enviar, log);
    expect(r).toEqual({ ok: true, arquivos: ['pokeidle-helper/x.json'] });
    expect(enviar).toHaveBeenCalledWith({ tipo: 'backup', partes: expect.any(Array) });
    expect(memoria.entradas.some((e) => e.msg === 'Backup gravado')).toBe(true);
  });

  it('registra WARN quando o service worker recusa ou falha', async () => {
    const { log, memoria } = logDeTeste();
    const recusa = await enviarBackup(
      montarBackup(sessoes, 'x', 1),
      async () => ({ ok: false as const, erro: 'bloqueado' }),
      log,
    );
    expect(recusa).toEqual({ ok: false, erro: 'bloqueado' });
    const falha = await enviarBackup(
      montarBackup(sessoes, 'x', 1),
      async () => Promise.reject(new Error('sem worker')),
      log,
    );
    expect(falha).toEqual({ ok: false, erro: 'sem worker' });
    expect(memoria.entradas.filter((e) => e.nivel === 'WARN')).toHaveLength(2);
  });
});

describe('importarTextos', () => {
  it('soma o resultado de vários arquivos e conta JSON quebrado como não reconhecido', async () => {
    const importar = vi.fn(async (json: unknown) =>
      Array.isArray((json as { sessoes?: unknown }).sessoes)
        ? { formatoValido: true, novas: 2, atualizadas: 1, mantidas: 0, invalidas: 1 }
        : { formatoValido: false, novas: 0, atualizadas: 0, mantidas: 0, invalidas: 0 },
    );
    const r = await importarTextos(['{"sessoes":[]}', '{"sessoes":[]}', '{quebrado'], importar);
    expect(r).toEqual({ formatoValido: true, novas: 4, atualizadas: 2, mantidas: 0, invalidas: 3 });
    expect(await importarTextos(['{quebrado'], importar)).toMatchObject({ formatoValido: false });
  });
});
