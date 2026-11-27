import { afterEach, describe, expect, it, vi } from 'vitest';
import { Aplicacao } from '../../src/content/aplicacao';
import { EstadoJogo } from '../../src/domain/estadoJogo';
import { CONFIG_PADRAO } from '../../src/shared/config';
import { baixarJson, montarInterface } from '../../src/ui/montar';
import { comSinal, curto, duracao, fracao, numero } from '../../src/ui/formatar';
import type { Sessao } from '../../src/domain/sessao';
import welcome from '../fixtures/welcome.json';
import batalhas from '../fixtures/batalha-bellsprout.json';
import { catalogos } from '../helpers/catalogos';
import { logDeTeste } from '../helpers/log';
import { PREFERENCIAS_PADRAO, type PreferenciasUi } from '../../src/shared/preferencias';

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

function acoesFalsas(preferencias: PreferenciasUi = PREFERENCIAS_PADRAO) {
  return {
    preferencias: () => preferencias,
    salvarPreferencias: vi.fn(),
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
    expect(duracao(21_000)).toBe('21s');
    expect(duracao(16 * 60_000)).toBe('16min');
    expect(duracao((147 * 60 + 58) * 60_000)).toBe('6d 03h');
    expect(curto(9_999)).toBe('9.999');
    expect(curto(11_520)).toMatch(/^11,5\s?mil$/);
    expect(curto(-655_000)).toMatch(/^-655\s?mil$/);
    expect(curto(null)).toBe('—');
    expect(comSinal(2_300)).toBe('+2.300');
    expect(comSinal(-12_400)).toMatch(/^-12,4\s?mil$/);
    expect(comSinal(0)).toBe('0');
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
    expect(raiz.textContent).toContain('Lucro real/h');
    expect(raiz.textContent).toMatch(/Seed\s*2\s*2 abates/);

    app.receber(env({ t: 'estado', estado: { huntSlug: 'geodude' } }, 240_000));
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
    expect(raiz.textContent).toMatch(
      /Dados de combate do ativos*IVs não · qualidade não · stats não/,
    );
    expect(raiz.textContent).toMatch(/Golpes da espécie do ativos*2/);
    expect(raiz.textContent).toMatch(/Versão do jogo\s*desconhecida/);
    app.definirVersaoJogo('1.492.0');
    await esperar();
    expect(raiz.textContent).toMatch(/Versão do jogo\s*1\.492\.0/);
  });

  it('troca o alerta teórico pelo dano real recebido quando há amostra', async () => {
    const app = criarApp();
    const ui = montarInterface(document, app, acoesFalsas());
    desmontar = ui.desmontar;
    clicar(ui.raiz, 'PH');
    app.receber(env(welcome, 0));
    for (const b of batalhas) app.receber(env({ t: 'batalha', ev: b.ev }, b.em));
    await esperar();
    expect(ui.raiz.textContent).not.toContain('dos golpes recebidos');

    const golpes = Array.from({ length: 20 }, (_, i) => ({
      k: 'ataque',
      por: 'selvagem',
      tipo: 'GRASS',
      dano: 100,
      ef: i < 10 ? 2 : 1,
    }));
    app.receber(env({ t: 'batalha', ev: golpes }, 100_000));
    await esperar();
    expect(ui.raiz.textContent).toContain('50% dos golpes recebidos foram super efetivos');
    expect(ui.raiz.textContent).toMatch(/dano médio\s*100/);
    expect(ui.raiz.textContent).not.toContain('acertam');
  });

  it('mostra quanto tempo dá para ficar na hunt com o estoque atual', async () => {
    const app = criarApp();
    const ui = montarInterface(document, app, acoesFalsas());
    desmontar = ui.desmontar;
    clicar(ui.raiz, 'PH');
    app.receber(env(welcome, 0));
    app.receber(
      env({ t: 'batalha', ev: [{ k: 'hunt', slug: 'bellsprout', nome: 'Bellsprout' }] }, 0),
    );
    app.receber(env({ t: 'batalha', ev: [{ k: 'spawn', speciesId: 69 }] }, 1000));
    await esperar();
    expect(ui.raiz.textContent).not.toContain('Autonomia');
    app.receber(env({ t: 'batalha', ev: [{ k: 'cura', itemId: 11 }] }, 1000));
    await esperar();
    expect(ui.raiz.textContent).toContain('Autonomia');
    expect(ui.raiz.textContent).toContain('medindo');

    for (let i = 1; i <= 12; i++) {
      const ev: unknown[] = [{ k: 'spawn', speciesId: 69 }];
      if (i % 2 === 0) ev.push({ k: 'cura', itemId: 11 });
      app.receber(env({ t: 'batalha', ev }, 1000 + i * 30_000));
    }
    app.receber(env({ t: 'estado', estado: { items: { '11': 7, '12': 2 } } }, 361_000));
    await esperar();
    expect(ui.raiz.textContent).toMatch(/Dá para ficar\s*~?6min/);
    expect(ui.raiz.textContent).toContain('acaba primeiro: Potion');
  });

  it('mostra a previsão do próximo nível, desmaios, XP perdido e taxa de captura', async () => {
    const app = criarApp();
    const ui = montarInterface(document, app, acoesFalsas());
    desmontar = ui.desmontar;
    clicar(ui.raiz, 'PH');
    await esperar(10);
    app.receber(
      env(
        {
          ...welcome,
          estado: {
            ...welcome.estado,
            level: 4,
            xp: 100,
            xpNivel: 0,
            xpProximo: 1000,
            pokemons: [
              { ...welcome.estado.pokemons[0], xp: 50, xpNivel: 0, xpProximo: 100 },
              welcome.estado.pokemons[1],
            ],
          },
        },
        0,
      ),
    );
    for (const b of batalhas) app.receber(env({ t: 'batalha', ev: b.ev }, b.em));
    app.receber(
      env(
        {
          t: 'batalha',
          ev: [{ k: 'xpPerdido', qtd: 30 }, { k: 'fugiu' }, { k: 'fugiu' }, { k: 'fugiu' }],
        },
        98_000,
      ),
    );
    await esperar();
    const texto = ui.raiz.textContent ?? '';
    expect(texto).toContain('Próximo nível');
    expect(texto).toMatch(/Treinador nv 5\s*10%/);
    expect(texto).toMatch(/Charmander nv 6\s*50%/);
    expect(texto).toMatch(/Desmaios\s*1/);
    expect(texto).toMatch(/XP perdido\s*30/);
    expect(texto).toMatch(/Captura\s*25%/);
  });

  it('aba Time: simula o time na hunt atual e as melhores hunts por pokémon', async () => {
    const app = criarApp();
    const ui = montarInterface(document, app, acoesFalsas());
    desmontar = ui.desmontar;
    clicar(ui.raiz, 'PH');
    await esperar(10);
    clicar(ui.raiz, 'Time');
    await esperar(10);
    expect(ui.raiz.textContent).toContain('Entre numa hunt');
    app.receber(env(welcome, 0));
    app.receber(env({ t: 'estado', estado: { huntSlug: 'geodude' } }, 1000));
    await esperar();
    const texto = ui.raiz.textContent ?? '';
    expect(texto).toContain('Seu time em Geodude');
    expect(texto.indexOf('Squirtle')).toBeLessThan(texto.indexOf('Charmander'));
    expect(texto).toMatch(/sem calibração/);
    const select = ui.raiz.querySelector('select[aria-label="Pokémon"]') as HTMLSelectElement;
    select.value = '2';
    select.dispatchEvent(new Event('change'));
    await esperar(10);
    expect(ui.raiz.textContent).toContain('Melhores hunts para Squirtle');
    expect(
      ui.raiz.querySelectorAll('table')[1]?.querySelectorAll('tbody tr').length,
    ).toBeGreaterThan(0);
  });

  it('aba Progresso: meta de nível, evolução, travados e refino', async () => {
    const app = criarApp();
    const ui = montarInterface(document, app, acoesFalsas());
    desmontar = ui.desmontar;
    clicar(ui.raiz, 'PH');
    await esperar(10);
    app.receber(
      env(
        {
          ...welcome,
          estado: {
            ...welcome.estado,
            level: 4,
            xp: 300,
            huntSlug: 'geodude',
            pokemons: [
              { ...welcome.estado.pokemons[0], xp: 2000, refino: { atk: 2 } },
              { ...welcome.estado.pokemons[1], level: 20 },
            ],
          },
        },
        0,
      ),
    );
    await esperar();
    clicar(ui.raiz, 'Progresso');
    await esperar(10);
    const texto = () => ui.raiz.textContent ?? '';
    expect(texto()).toContain('Charmander evolui no nv 40');
    expect(texto()).toMatch(/Squirtle\s*nv 20 · libera com o treinador no nv 15/);
    expect(texto()).toMatch(/Refino de Charmander/);
    expect(texto()).toMatch(/atk\s*2\s*9\.500/);
    const alvo = ui.raiz.querySelector(
      'input[aria-label="Nível-alvo do treinador"]',
    ) as HTMLInputElement;
    alvo.value = '10';
    alvo.dispatchEvent(new Event('input'));
    await esperar(10);
    expect(texto()).toMatch(/faltam\s*[\d.]+ XP/);
  });

  it('mostra onde vai o tempo: luta, deslocamento e espera de onda', async () => {
    const app = criarApp();
    const ui = montarInterface(document, app, acoesFalsas());
    desmontar = ui.desmontar;
    clicar(ui.raiz, 'PH');
    await esperar(10);
    app.receber(env(welcome, 0));
    const seq: [unknown, number][] = [
      [{ k: 'spawn', speciesId: 69 }, 1_000],
      [{ k: 'ataque', por: 'jogador', dano: 60 }, 3_000],
      [{ k: 'ataque', por: 'jogador', dano: 40 }, 4_000],
      [{ k: 'morte', quem: 'selvagem', xp: 8, ouro: 41, drops: [] }, 6_000],
      [{ k: 'spawn', speciesId: 69 }, 8_000],
    ];
    for (const [ev, em] of seq) app.receber(env({ t: 'batalha', ev: [ev] }, em));
    await esperar();
    const texto = ui.raiz.textContent ?? '';
    expect(texto).toContain('Onde vai o tempo');
    expect(texto).toMatch(/Lutando\s*43%/);
    expect(texto).toMatch(/Andando\s*29%/);
    expect(texto).toMatch(/Esperando onda\s*29%/);
    expect(texto).toMatch(/2 golpes por abate/);
    expect(ui.raiz.querySelector('.barra-fases')).not.toBeNull();
  });

  it('aba Economia: captura por bola, melhor bola, shiny e pedras', async () => {
    const app = criarApp();
    const ui = montarInterface(document, app, acoesFalsas());
    desmontar = ui.desmontar;
    clicar(ui.raiz, 'PH');
    await esperar(10);
    clicar(ui.raiz, 'Economia');
    await esperar(10);
    expect(ui.raiz.textContent).toContain('Entre numa hunt');
    app.receber(env({ ...welcome, estado: { ...welcome.estado, balls: { '1': 30 } } }, 0));
    app.receber(env({ t: 'estado', estado: { huntSlug: 'geodude' } }, 1000));
    await esperar();
    const texto = ui.raiz.textContent ?? '';
    expect(texto).toContain('Economia em Geodude');
    expect(texto).toMatch(/Geodude.*melhor: Poke Ball/);
    expect(texto).toMatch(/1 shiny a cada\s*2\.000 arremessos/);
    expect(texto).toContain('Rock Stone');
  });

  it('lista as sessões salvas na aba Histórico com filtro por hunt', async () => {
    const app = criarApp();
    const ui = montarInterface(document, app, acoesFalsas());
    desmontar = ui.desmontar;
    clicar(ui.raiz, 'PH');
    await esperar(10);
    clicar(ui.raiz, 'Histórico');
    await esperar(10);
    expect(ui.raiz.textContent).toContain('Nenhuma sessão salva ainda');

    app.receber(env(welcome, 0));
    for (const b of batalhas) app.receber(env({ t: 'batalha', ev: b.ev }, b.em));
    app.receber(env({ t: 'estado', estado: { huntSlug: 'geodude' } }, 240_000));
    await esperar();
    const texto = ui.raiz.textContent ?? '';
    expect(texto).toContain('Bellsprout');
    expect(texto).toMatch(/1 sessão/);
    const select = ui.raiz.querySelector(
      'select[aria-label="Filtrar por hunt"]',
    ) as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toEqual(['', 'bellsprout']);
    select.value = 'bellsprout';
    select.dispatchEvent(new Event('change'));
    await esperar(10);
    expect(ui.raiz.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('filtra as hunts pelo nível do pokémon ativo no formato real do estado', async () => {
    const app = criarApp();
    const ui = montarInterface(document, app, acoesFalsas());
    desmontar = ui.desmontar;
    clicar(ui.raiz, 'PH');
    await esperar(10);
    app.receber(env(welcome, 0));
    await esperar();
    clicar(ui.raiz, 'Hunts');
    await esperar(10);
    const caixa = ui.raiz.querySelector('input[type="checkbox"]') as HTMLInputElement;
    caixa.click();
    await esperar(10);
    const nomes = () =>
      [...ui.raiz.querySelectorAll('tbody td:first-child')].map((td) => td.textContent ?? '');
    expect(nomes().some((n) => n.includes('Geodude'))).toBe(false);
    expect(nomes().some((n) => n.includes('Oddish'))).toBe(true);
    expect(ui.raiz.textContent).toMatch(/até o nível do ativo \(5\)/);

    app.receber(
      env({ t: 'estado', estado: { pkMud: [{ id: 1, speciesId: 4, level: 50 }] } }, 1000),
    );
    await esperar();
    expect(nomes().some((n) => n.includes('Geodude'))).toBe(true);
  });

  it('mostra os bônus ativos aplicados às estimativas', async () => {
    const app = criarApp();
    const ui = montarInterface(document, app, acoesFalsas());
    desmontar = ui.desmontar;
    clicar(ui.raiz, 'PH');
    await esperar(10);
    const futuro = Date.now() + 3_600_000;
    app.receber(
      env(
        {
          ...welcome,
          tiposBoost: [{ chave: 'loot', mult: 1.5 }],
          estado: { ...welcome.estado, loja: { vipAte: futuro, boosts: { loot: futuro } } },
        },
        0,
      ),
    );
    await esperar();
    clicar(ui.raiz, 'Hunts');
    await esperar(10);
    expect(ui.raiz.textContent).toContain(
      'Estimativas com bônus ativos: VIP ×1,5 · boost loot ×1,5',
    );
  });

  it('avisa quando o nível do ativo é desconhecido em vez de filtrar em silêncio', async () => {
    const app = criarApp();
    const ui = montarInterface(document, app, acoesFalsas());
    desmontar = ui.desmontar;
    clicar(ui.raiz, 'PH');
    await esperar(10);
    app.receber(env({ ...welcome, estado: { cheio: true, nick: 'x', pokemons: [] } }, 0));
    await esperar();
    clicar(ui.raiz, 'Hunts');
    await esperar(10);
    (ui.raiz.querySelector('input[type="checkbox"]') as HTMLInputElement).click();
    await esperar(10);
    expect(ui.raiz.textContent).toContain('nível do pokémon ativo ainda não foi identificado');
  });

  it('minimiza, restaura e salva a preferência', async () => {
    const app = criarApp();
    const acoes = acoesFalsas();
    const ui = montarInterface(document, app, acoes);
    desmontar = ui.desmontar;
    clicar(ui.raiz, 'PH');
    await esperar(10);
    (ui.raiz.querySelector('button[aria-label="Minimizar"]') as HTMLButtonElement).click();
    await esperar(10);
    expect(ui.raiz.querySelector('.conteudo')).toBeNull();
    expect(acoes.salvarPreferencias).toHaveBeenLastCalledWith(
      expect.objectContaining({ minimizado: true }),
    );
    (ui.raiz.querySelector('button[aria-label="Restaurar"]') as HTMLButtonElement).click();
    await esperar(10);
    expect(ui.raiz.querySelector('.conteudo')).not.toBeNull();
    clicar(ui.raiz, 'Hunts');
    await esperar(10);
    expect(acoes.salvarPreferencias).toHaveBeenLastCalledWith(
      expect.objectContaining({ aba: 'hunts' }),
    );
  });

  it('arrasta o painel pelo cabeçalho e salva a posição', async () => {
    const app = criarApp();
    const acoes = acoesFalsas();
    const ui = montarInterface(document, app, acoes);
    desmontar = ui.desmontar;
    clicar(ui.raiz, 'PH');
    await esperar(10);
    const cabecalho = ui.raiz.querySelector('.cabecalho') as HTMLElement;
    cabecalho.dispatchEvent(
      new MouseEvent('mousedown', { clientX: 100, clientY: 100, button: 0, bubbles: true }),
    );
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 130 }));
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 150, clientY: 130 }));
    await esperar(10);
    const painel = ui.raiz.querySelector('section.painel') as HTMLElement;
    expect(painel.style.left).toBe('50px');
    expect(painel.style.top).toBe('30px');
    expect(acoes.salvarPreferencias).toHaveBeenLastCalledWith(
      expect.objectContaining({ posicao: { x: 50, y: 30 } }),
    );
  });

  it('abre com a aba, a posição e o estado salvos', async () => {
    const app = criarApp();
    const ui = montarInterface(
      document,
      app,
      acoesFalsas({ posicao: { x: 12, y: 34 }, minimizado: false, aba: 'opcoes' }),
    );
    desmontar = ui.desmontar;
    clicar(ui.raiz, 'PH');
    await esperar(10);
    const painel = ui.raiz.querySelector('section.painel') as HTMLElement;
    expect(painel.style.left).toBe('12px');
    expect(ui.raiz.textContent).toContain('Exportar dados');
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
