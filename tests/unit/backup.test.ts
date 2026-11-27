import { describe, expect, it } from 'vitest';
import {
  FORMATO_BACKUP,
  lerBackup,
  mesclarSessoes,
  montarBackup,
  particionarSessoes,
} from '../../src/domain/backup';
import { VERSAO_SESSAO, novaSessao, type Sessao } from '../../src/domain/sessao';

const sessao = (id: string, msAtivo = 600_000): Sessao => ({
  ...novaSessao('bellsprout', 'Bellsprout', 0),
  id,
  msAtivo,
  abates: 10,
  aberta: false,
});

describe('montarBackup', () => {
  it('embala todas as sessões com formato, versão e data', () => {
    const b = montarBackup([sessao('a'), sessao('b')], '0.8.0', 123);
    expect(b).toEqual({
      formato: FORMATO_BACKUP,
      versao: '0.8.0',
      geradoEm: 123,
      sessoes: [sessao('a'), sessao('b')],
    });
  });
});

describe('lerBackup', () => {
  it('aceita o backup, a exportação manual e uma lista direta', () => {
    const lista = [sessao('a'), sessao('b')];
    expect(lerBackup(montarBackup(lista, 'x', 1)).sessoes).toHaveLength(2);
    expect(lerBackup({ versao: '0.5.0', exportadoEm: 1, sessoes: lista }).sessoes).toHaveLength(2);
    expect(lerBackup(lista).sessoes).toHaveLength(2);
  });

  it('normaliza sessões antigas, fecha as abertas e descarta as inválidas', () => {
    const antiga = { ...sessao('a'), schemaVersion: 1, aberta: true } as Partial<Sessao>;
    delete antiga.fases;
    delete antiga.golpesDados;
    const r = lerBackup({
      sessoes: [
        antiga,
        { id: '', huntSlug: 'x' },
        { id: 'sem-hunt', msAtivo: 1 },
        { ...sessao('neg'), msAtivo: -5 },
        'lixo',
      ],
    });
    expect(r.invalidas).toBe(4);
    expect(r.sessoes).toHaveLength(1);
    expect(r.sessoes[0]).toMatchObject({
      id: 'a',
      schemaVersion: VERSAO_SESSAO,
      aberta: false,
      golpesDados: 0,
      fases: { lutaMs: 0, deslocamentoMs: 0, esperaMs: 0, ondas: 0 },
    });
  });

  it('arquivo sem sessões é inválido', () => {
    expect(lerBackup('lixo')).toEqual({ sessoes: [], invalidas: 0, formatoValido: false });
    expect(lerBackup({ outra: 1 }).formatoValido).toBe(false);
  });
});

describe('mesclarSessoes', () => {
  it('acrescenta novas e, em conflito, fica a mais completa', () => {
    const atuais = new Map([
      ['a', sessao('a', 100)],
      ['b', sessao('b', 900)],
    ]);
    const r = mesclarSessoes(atuais, [sessao('a', 500), sessao('b', 200), sessao('c')]);
    expect(r).toEqual({ novas: 1, atualizadas: 1, mantidas: 1 });
    expect(atuais.get('a')?.msAtivo).toBe(500);
    expect(atuais.get('b')?.msAtivo).toBe(900);
    expect(atuais.has('c')).toBe(true);
  });
});

describe('particionarSessoes', () => {
  it('divide em partes que cabem no limite de bytes, sem perder sessões', () => {
    const lista = Array.from({ length: 10 }, (_, i) => sessao(`s${i}`));
    const umaSessao = JSON.stringify(lista[0]).length;
    const partes = particionarSessoes(lista, umaSessao * 3 + 10);
    expect(partes.length).toBeGreaterThan(1);
    expect(partes.flat()).toHaveLength(10);
    expect(partes.every((p) => p.length > 0)).toBe(true);
    expect(particionarSessoes([], 1000)).toEqual([[]]);
    expect(particionarSessoes(lista, 1)).toHaveLength(10);
  });
});
