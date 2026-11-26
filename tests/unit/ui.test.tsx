import { afterEach, describe, expect, it, vi } from 'vitest';
import { Aplicacao } from '../../src/content/aplicacao';
import { EstadoJogo } from '../../src/domain/estadoJogo';
import { CONFIG_PADRAO } from '../../src/shared/config';
import { baixarJson, montarInterface } from '../../src/ui/montar';
import { duracao, fracao, numero } from '../../src/ui/formatar';
import type { Sessao } from '../../src/domain/sessao';
import welcome from '../fixtures/welcome.json';
import batalhas from '../fixtures/batalha-bellsprout.json';
import { catalogos } from '../helpers/catalogos';
import { logDeTeste } from '../helpers/log';

const esperar = (ms = 300) => new Promise((r) => setTimeout(r, ms));
const env = (dados: unknown, recebidoEm: number) => ({
  origem: 'pokeidle-helper' as const,
  v: 1 as const,
  tipo: 'mensagem' as const,
  recebidoEm,
  dados,
});

function criarApp() {
  const { log } = logDeTeste();
  const { especies, itens } = catalogos();
  const memoria = new Map<string, Sessao>();
  return new Aplicacao({
    config: { ...CONFIG_PADRAO, sessaoMinimaMs: 0 },
    log,
    estado: new EstadoJogo(log),
    repositorio: {
      salvar: async (s) => memoria.set(s.id, s),
      listar: async () => [...memoria.values()],
      limpar: async () => memoria.clear(),
    },
    especies,
    itens,
    versao: '0.1.0-teste',
  });
}

function acoesFalsas() {
  return {
    exportarDados: vi.fn(),
    exportarLogs: vi.fn(),
    limparHistorico: vi.fn(async () => undefined),
    definirNivelLog: vi.fn(),
    nivelLog: () => 'INFO' as const,
  };
}

let desmontar: (() => void) | null = null;
afterEach(() => {
  desmontar?.();
  desmontar = null;
});

const clicar = (raiz: ShadowRoot, texto: string) => {
  const alvo = [...raiz.querySelectorAll('button')].find((b) => b.textContent?.trim() === texto);
  if (!alvo) throw new Error(`botão "${texto}" não encontrado`);
  alvo.click();
};

describe('formatação', () => {
  it('formata números, frações e durações em pt-BR', () => {
    expect(numero(1234)).toBe('1.234');
    expect(numero(2_500_000)).toMatch(/2,5\s?mi/);
    expect(numero(null)).toBe('—');
    expect(fracao(1.234)).toBe('1,23');
    expect(fracao(Number.NaN)).toBe('—');
    expect(duracao(3_725_000)).toBe('1h 02min');
    expect(duracao(65_000)).toBe('1min 05s');
  });
});

describe('painel', () => {
  it('mostra aguardando login, depois sessão, ranking e opções', async () => {
    const app = criarApp();
    const acoes = acoesFalsas();
    const ui = montarInterface(document, app, acoes);
    desmontar = ui.desmontar;
    const raiz = ui.raiz;
    clicar(raiz, 'PH');
    await esperar(10);
    expect(raiz.textContent).toContain('Aguardando os dados de login');

    app.receber(env(welcome, 0));
    for (const b of batalhas) app.receber(env({ t: 'batalha', ev: b.ev }, b.em));
    await esperar();
    expect(raiz.textContent).toContain('Bellsprout');
    expect(raiz.textContent).toContain('Lucro líquido/h');
    expect(raiz.textContent).toContain('Potion');

    app.receber(env({ t: 'estado', estado: { eu: { huntSlug: 'geodude' } } }, 240_000));
    await esperar();
    expect(raiz.textContent).toContain('desvantagem de tipo');
    expect(raiz.textContent).toContain('Squirtle do seu time rende mais');

    clicar(raiz, 'Hunts');
    await esperar(10);
    expect(raiz.textContent).toContain('Geodude');
    expect(raiz.textContent).toMatch(/real|estimado/);
    clicar(raiz, 'XP/h');
    const caixa = raiz.querySelector('input[type="checkbox"]') as HTMLInputElement;
    caixa.click();
    await esperar(10);
    expect(raiz.querySelectorAll('tbody tr').length).toBeGreaterThan(0);

    clicar(raiz, 'Opções');
    await esperar(10);
    clicar(raiz, 'Exportar dados (JSON)');
    clicar(raiz, 'Exportar logs');
    expect(acoes.exportarDados).toHaveBeenCalled();
    expect(acoes.exportarLogs).toHaveBeenCalled();
    const select = raiz.querySelector('select') as HTMLSelectElement;
    select.value = 'DEBUG';
    select.dispatchEvent(new Event('change'));
    expect(acoes.definirNivelLog).toHaveBeenCalledWith('DEBUG');
    clicar(raiz, 'Limpar histórico');
    await esperar(10);
    clicar(raiz, 'Cancelar');
    await esperar(10);
    clicar(raiz, 'Limpar histórico');
    await esperar(10);
    clicar(raiz, 'Sim, apagar');
    expect(acoes.limparHistorico).toHaveBeenCalledTimes(1);
    expect(raiz.textContent).toContain('0.1.0-teste');
    expect(raiz.textContent).toMatch(/Versão do jogo\s*desconhecida/);
    app.definirVersaoJogo('1.492.0');
    await esperar();
    expect(raiz.textContent).toMatch(/Versão do jogo\s*1\.492\.0/);
  });

  it('remonta sem duplicar e baixa JSON pelo shadow root', () => {
    const app = criarApp();
    const a = montarInterface(document, app, acoesFalsas());
    const b = montarInterface(document, app, acoesFalsas());
    desmontar = b.desmontar;
    expect(document.querySelectorAll('#pokeidle-helper-raiz')).toHaveLength(1);
    void a;
    const criar = vi.fn(() => 'blob:teste');
    const revogar = vi.fn();
    Object.assign(URL, { createObjectURL: criar, revokeObjectURL: revogar });
    const clique = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    baixarJson(document, b.raiz, 'x.json', { a: 1 });
    expect(criar).toHaveBeenCalled();
    expect(clique).toHaveBeenCalled();
    expect(b.raiz.querySelector('a')).toBeNull();
    clique.mockRestore();
  });
});
