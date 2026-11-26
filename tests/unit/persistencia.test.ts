import { afterEach, describe, expect, it } from 'vitest';
import { abrirBanco, type Banco } from '../../src/persistence/banco';
import { DestinoLogBanco } from '../../src/persistence/destinoLogBanco';
import { RepositorioSessoes } from '../../src/persistence/repositorioSessoes';
import { novaSessao } from '../../src/domain/sessao';
import type { EntradaLog } from '../../src/shared/logger';

let contador = 0;
const abertos: Banco[] = [];
async function banco() {
  const b = await abrirBanco(`teste-${contador++}`);
  abertos.push(b);
  return b;
}
afterEach(() => abertos.splice(0).forEach((b) => b.close()));

const entrada = (i: number, msg = 'x'.repeat(80)): EntradaLog => ({
  ts: i,
  nivel: 'INFO',
  modulo: 'teste',
  msg: `${i}-${msg}`,
});

describe('RepositorioSessoes', () => {
  it('salva com upsert, lista por hunt e por início, fecha abertas e limpa', async () => {
    const repo = new RepositorioSessoes(await banco());
    const a = novaSessao('bellsprout', 'Bellsprout', 200);
    const b = novaSessao('geodude', 'Geodude', 100);
    await repo.salvar(a);
    await repo.salvar(b);
    await repo.salvar({ ...a, abates: 10 });
    expect((await repo.listar()).map((s) => s.id)).toEqual([b.id, a.id]);
    expect(await repo.listarPorHunt('bellsprout')).toEqual([{ ...a, abates: 10 }]);
    expect(await repo.fecharAbertas()).toBe(2);
    expect((await repo.listar()).every((s) => !s.aberta)).toBe(true);
    await repo.limpar();
    expect(await repo.listar()).toEqual([]);
  });
});

describe('DestinoLogBanco', () => {
  it('grava em lote e exporta', async () => {
    const destino = new DestinoLogBanco(await banco(), {
      maxBytesPorSegmento: 1_000_000,
      maxSegmentos: 3,
    });
    for (let i = 0; i < 5; i++) destino.gravar(entrada(i));
    const exportado = await destino.exportar();
    expect(exportado.map((e) => e.ts)).toEqual([0, 1, 2, 3, 4]);
    expect(exportado.every((e) => e.segmento === 1)).toBe(true);
  });

  it('rotaciona segmentos e mantém só os mais recentes', async () => {
    const b = await banco();
    const destino = new DestinoLogBanco(b, { maxBytesPorSegmento: 1000, maxSegmentos: 2 });
    for (let i = 0; i < 40; i++) destino.gravar(entrada(i));
    await destino.descarregar();
    for (let i = 40; i < 60; i++) destino.gravar(entrada(i));
    const exportado = await destino.exportar();
    const segmentos = [...new Set(exportado.map((e) => e.segmento))];
    expect(segmentos.length).toBeLessThanOrEqual(2);
    expect(exportado.at(-1)!.ts).toBe(59);
    expect(exportado[0]!.ts).toBeGreaterThan(0);
    const destino2 = new DestinoLogBanco(b, { maxBytesPorSegmento: 1000, maxSegmentos: 2 });
    destino2.gravar(entrada(60));
    const depois = await destino2.exportar();
    expect(depois.at(-1)!.segmento).toBe(Math.max(...segmentos));
  });

  it('limpa os logs', async () => {
    const destino = new DestinoLogBanco(await banco(), {
      maxBytesPorSegmento: 1000,
      maxSegmentos: 2,
    });
    destino.gravar(entrada(1));
    await destino.descarregar();
    await destino.limpar();
    expect(await destino.exportar()).toEqual([]);
  });
});
