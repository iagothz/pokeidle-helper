import { describe, expect, it, vi } from 'vitest';
import { CONFIG_PADRAO, mesclarConfig } from '../../src/shared/config';
import {
  DestinoConsole,
  DestinoMemoria,
  GerenciadorLog,
  erroParaCtx,
} from '../../src/shared/logger';
import { removerSensiveis } from '../../src/shared/sanitize';

describe('config', () => {
  it('usa o padrão e aplica overrides válidos', () => {
    expect(mesclarConfig(undefined).config).toBe(CONFIG_PADRAO);
    expect(mesclarConfig({ logLevel: 'DEBUG', pausaMaximaMs: 30_000 }).config).toMatchObject({
      logLevel: 'DEBUG',
      pausaMaximaMs: 30_000,
    });
  });

  it('rejeita overrides inválidos e não deixa mudar origem nem logs', () => {
    const r = mesclarConfig({ logLevel: 'VERBOSO' });
    expect(r.config).toBe(CONFIG_PADRAO);
    expect(r.avisos[0]).toMatch(/logLevel/);
    expect(mesclarConfig([1]).avisos).toHaveLength(1);
    expect(
      mesclarConfig({ jogo: { origem: 'https://malicioso.example' } }).config.jogo.origem,
    ).toBe('https://pokeidle.io');
  });
});

describe('logger', () => {
  it('filtra por nível, propaga módulo e isola destinos com falha', () => {
    const memoria = new DestinoMemoria(3);
    const g = new GerenciadorLog('INFO', () => 42);
    g.adicionarDestino({
      gravar: () => {
        throw new Error('x');
      },
    });
    g.adicionarDestino(memoria);
    const log = g.logger('app').filho('sessao');
    log.debug('oculto');
    log.info('a');
    log.warn('b', { n: 1 });
    log.error('c');
    g.definirNivel('DEBUG');
    log.debug('d');
    expect(memoria.entradas.map((e) => e.msg)).toEqual(['b', 'c', 'd']);
    expect(memoria.entradas[0]).toEqual({
      ts: 42,
      nivel: 'WARN',
      modulo: 'app.sessao',
      msg: 'b',
      ctx: { n: 1 },
    });
  });

  it('escreve no console no nível certo', () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const c = new DestinoConsole();
    c.gravar({ ts: 0, nivel: 'ERROR', modulo: 'm', msg: 'x', ctx: { a: 1 } });
    c.gravar({ ts: 0, nivel: 'WARN', modulo: 'm', msg: 'y' });
    c.gravar({ ts: 0, nivel: 'INFO', modulo: 'm', msg: 'z' });
    expect(erro).toHaveBeenCalledWith(expect.stringContaining('ERROR m: x'), { a: 1 });
    expect(aviso).toHaveBeenCalledTimes(1);
    expect(debug).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });

  it('converte erros em contexto', () => {
    expect(erroParaCtx(new Error('falhou'))).toMatchObject({ erro: 'falhou' });
    expect(erroParaCtx('texto')).toEqual({ erro: 'texto' });
  });
});

describe('removerSensiveis', () => {
  it('remove chaves sensíveis em qualquer profundidade e mantém o resto', () => {
    const entrada = {
      t: 'welcome',
      token: 'x',
      a: [{ email: 'e', b: 1 }],
      c: { CPF: '1', d: { carteira: 'w', ip: '1.2.3.4', e: null } },
    };
    expect(removerSensiveis(entrada)).toEqual({
      t: 'welcome',
      a: [{ b: 1 }],
      c: { d: { e: null } },
    });
    expect(removerSensiveis('texto')).toBe('texto');
  });
});
