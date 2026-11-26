import { afterEach, describe, expect, it } from 'vitest';
import { Aplicacao } from '../../src/content/aplicacao';
import { EstadoJogo } from '../../src/domain/estadoJogo';
import { lerVersaoJogo } from '../../src/domain/versaoJogo';
import type { Sessao } from '../../src/domain/sessao';
import { CONFIG_PADRAO } from '../../src/shared/config';
import { VERSAO_JOGO_VALIDADA } from '../../src/shared/protocolo';
import { catalogos } from '../helpers/catalogos';
import { logDeTeste } from '../helpers/log';

function documentoCom(...srcs: string[]): Document {
  const doc = document.implementation.createHTMLDocument('jogo');
  const base = doc.createElement('base');
  base.href = 'https://pokeidle.io/app';
  doc.head.appendChild(base);
  for (const src of srcs) {
    const script = doc.createElement('script');
    script.setAttribute('src', src);
    doc.head.appendChild(script);
  }
  return doc;
}

function criarApp() {
  const { log, memoria } = logDeTeste();
  const { especies, itens } = catalogos();
  const sessoes = new Map<string, Sessao>();
  const app = new Aplicacao({
    config: CONFIG_PADRAO,
    log,
    estado: new EstadoJogo(log),
    repositorio: {
      salvar: async (s) => sessoes.set(s.id, s),
      listar: async () => [...sessoes.values()],
      limpar: async () => sessoes.clear(),
    },
    especies,
    itens,
    versao: '0.2.0-teste',
  });
  return { app, memoria };
}

describe('lerVersaoJogo', () => {
  it('lê a versão do parâmetro v do app.js', () => {
    const doc = documentoCom('/cookies.js?v=1.0.0', 'escala-ui.js?v=1.492.0', 'app.js?v=1.492.0');
    expect(lerVersaoJogo(doc)).toBe('1.492.0');
  });

  it('aceita caminho absoluto e URL completa do app.js', () => {
    expect(lerVersaoJogo(documentoCom('/app.js?v=2.0.1'))).toBe('2.0.1');
    expect(lerVersaoJogo(documentoCom('https://pokeidle.io/app.js?v=3.1.4'))).toBe('3.1.4');
  });

  it('retorna null sem app.js, sem v ou com formato inválido', () => {
    expect(lerVersaoJogo(documentoCom('escala-ui.js?v=1.492.0'))).toBeNull();
    expect(lerVersaoJogo(documentoCom('app.js'))).toBeNull();
    expect(lerVersaoJogo(documentoCom('app.js?v=1.492'))).toBeNull();
    expect(lerVersaoJogo(documentoCom('app.js?v=<script>'))).toBeNull();
    expect(lerVersaoJogo(documentoCom('outro-app.js?v=1.2.3'))).toBeNull();
  });
});

describe('Aplicacao.definirVersaoJogo', () => {
  let parar: (() => void) | null = null;
  afterEach(() => {
    parar?.();
    parar = null;
  });

  it('não avisa quando a versão é a validada e a mostra no diagnóstico', () => {
    const { app } = criarApp();
    app.definirVersaoJogo(VERSAO_JOGO_VALIDADA);
    const m = app.modelo();
    expect(m.diagnostico.versaoJogo).toBe(VERSAO_JOGO_VALIDADA);
    expect(m.avisos).toEqual([]);
  });

  it('avisa e registra WARN quando o jogo está em outra versão', () => {
    const { app, memoria } = criarApp();
    let notificacoes = 0;
    parar = app.inscrever(() => notificacoes++);
    app.definirVersaoJogo('9.9.9');
    const m = app.modelo();
    expect(m.diagnostico.versaoJogo).toBe('9.9.9');
    expect(m.avisos).toHaveLength(1);
    expect(m.avisos[0]).toContain('9.9.9');
    expect(m.avisos[0]).toContain(VERSAO_JOGO_VALIDADA);
    expect(notificacoes).toBeGreaterThan(0);
    const aviso = memoria.entradas.find((e) => e.nivel === 'WARN');
    expect(aviso?.ctx).toMatchObject({ versaoJogo: '9.9.9', validada: VERSAO_JOGO_VALIDADA });
  });

  it('sem versão identificada só registra WARN, sem aviso no painel', () => {
    const { app, memoria } = criarApp();
    app.definirVersaoJogo(null);
    const m = app.modelo();
    expect(m.diagnostico.versaoJogo).toBeNull();
    expect(m.avisos).toEqual([]);
    expect(memoria.entradas.some((e) => e.nivel === 'WARN')).toBe(true);
  });
});
