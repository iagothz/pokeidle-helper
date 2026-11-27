import { describe, expect, it } from 'vitest';
import type { Jogador } from '../../src/domain/estadoJogo';
import { lerAutomacao } from '../../src/domain/schemas';
import type { Comando, EnvelopeComando } from '../../src/shared/comandos';
import {
  PREFERENCIAS_AUTOMACAO_PADRAO,
  lerPreferenciasAutomacao,
  regraPadrao,
  type PreferenciasAutomacao,
} from '../../src/shared/preferenciasAutomacao';
import { AutoBallDex, pacoteAutoSet } from '../../src/content/automacao/autoBallDex';
import { CapturaCaidos } from '../../src/content/automacao/capturaCaidos';
import type { ContextoAutomacao } from '../../src/content/automacao/contexto';
import { Emissor } from '../../src/content/automacao/emissor';
import { MelhorAtivo } from '../../src/content/automacao/melhorAtivo';
import { Reposicao } from '../../src/content/automacao/reposicao';
import { Rotacao, escolherHunt, type CandidataRotacao } from '../../src/content/automacao/rotacao';
import { ServicoAutomacao } from '../../src/content/automacao/servicoAutomacao';
import { Viagem } from '../../src/content/automacao/viagem';
import { logDeTeste } from '../helpers/log';

function jogador(parcial: Partial<Jogador> = {}): Jogador {
  return {
    level: 100,
    gold: 1_000_000,
    activeId: '1',
    huntSlug: 'a',
    noCentro: false,
    pokemons: [],
    itens: {},
    bolas: { '1': 50 },
    especiesCapturadas: new Set([10]),
    automacao: lerAutomacao({}),
    vip: true,
    ...parcial,
  };
}

function contexto(j: Jogador | null = jogador()) {
  const { log, memoria } = logDeTeste();
  const enviados: Comando[] = [];
  const estado = { agora: 0, jogador: j, aceitar: true };
  const ctx: ContextoAutomacao = {
    agora: () => estado.agora,
    jogador: () => estado.jogador,
    enviar: (c) => {
      if (!estado.aceitar) return false;
      enviados.push(c);
      return true;
    },
    log,
  };
  return { ctx, enviados, estado, memoria };
}

describe('preferências de automação', () => {
  it('vêm desligadas por padrão e descartam regras inválidas', () => {
    expect(lerPreferenciasAutomacao(undefined)).toEqual(PREFERENCIAS_AUTOMACAO_PADRAO);
    const p = lerPreferenciasAutomacao({
      ligada: true,
      reposicao: {
        ligada: true,
        reservaGold: -5,
        regras: [regraPadrao('ball', 3), { kind: 'ball', id: 4, minimo: 500, alvo: 100 }, 'x'],
      },
      rotacao: { ligada: true, criterio: 'outro' },
    });
    expect(p.ligada).toBe(true);
    expect(p.viagem).toBe(true);
    expect(p.reposicao.reservaGold).toBe(0);
    expect(p.reposicao.regras).toEqual([{ kind: 'ball', id: 3, minimo: 200, alvo: 1000 }]);
    expect(p.rotacao.criterio).toBe('lucro');
  });
});

describe('emissor', () => {
  it('só envia com a chave geral ligada e registra o resultado', () => {
    const { log, memoria } = logDeTeste();
    const postados: EnvelopeComando[] = [];
    let ligado = false;
    const e = new Emissor({
      postar: (x) => postados.push(x),
      ligado: () => ligado,
      agora: () => 5,
      log,
    });
    expect(e.enviar({ t: 'hunt.select', slug: 'a' }, 'teste')).toBe(false);
    ligado = true;
    expect(e.enviar({ t: 'hunt.select', slug: 'a' }, 'teste')).toBe(true);
    expect(e.enviar({ t: 'hunt.select', slug: '../x' } as Comando, 'teste')).toBe(false);
    expect(postados).toHaveLength(1);
    expect(postados[0]).toMatchObject({ origem: 'pokeidle-helper.comando', id: 1 });
    e.aoResultado({ id: 1, t: 'hunt.select', enviado: false, motivo: 'limite' });
    expect(e.historico()[0]).toMatchObject({ situacao: 'recusado', motivo: 'limite', resumo: 'a' });
    expect(memoria.entradas.some((x) => x.nivel === 'WARN')).toBe(true);
  });
});

describe('viagem', () => {
  it('tenta a cada segundo até chegar', () => {
    const c = contexto(jogador({ huntSlug: 'a' }));
    const v = new Viagem(c.ctx);
    v.iniciar('b');
    c.estado.agora = 500;
    v.tique();
    c.estado.agora = 1000;
    v.tique();
    expect(c.enviados).toEqual([
      { t: 'hunt.select', slug: 'b' },
      { t: 'hunt.select', slug: 'b' },
    ]);
    c.estado.jogador = jogador({ huntSlug: 'b' });
    v.tique();
    expect(v.status).toBeNull();
    expect(v.ultimo).toMatchObject({ alvo: 'b', fim: 'chegou', tentativas: 2 });
  });

  it('para no tempo máximo, ao cancelar e na troca manual', () => {
    const c = contexto(jogador({ huntSlug: 'a' }));
    const v = new Viagem(c.ctx, { intervaloMs: 1000, limiteMs: 3000 });
    v.iniciar('b');
    c.estado.agora = 3000;
    v.tique();
    expect(v.ultimo?.fim).toBe('tempo-esgotado');
    v.iniciar('b');
    v.cancelar();
    expect(v.ultimo?.fim).toBe('cancelada');
    v.iniciar('b');
    c.estado.jogador = jogador({ huntSlug: 'z' });
    v.tique();
    expect(v.ultimo?.fim).toBe('troca-manual');
  });

  it('não considera chegada enquanto está no centro e troca o alvo ao reiniciar', () => {
    const c = contexto(jogador({ huntSlug: 'b', noCentro: true }));
    const v = new Viagem(c.ctx);
    v.iniciar('b');
    expect(v.status?.alvo).toBe('b');
    v.iniciar('c');
    expect(v.status?.alvo).toBe('c');
  });
});

describe('auto-ball em espécie fora da pokédex', () => {
  it('liga "até capturar" com VIP preservando as outras automações', () => {
    const c = contexto(
      jogador({ automacao: lerAutomacao({ autoRevive: true, reviveIds: [7], hpLimiar: 0.3 }) }),
    );
    const a = new AutoBallDex(c.ctx);
    expect(a.aoSpawn(10)).toBe('ja-capturada');
    expect(a.aoSpawn(99)).toBe('ligou');
    expect(c.enviados[0]).toEqual({
      t: 'auto.set',
      autoBallAteCapturar: true,
      autoBallSemParar: false,
      autoBall: false,
      ballIds: [1],
      autoRevive: true,
      reviveIds: [7],
      autoPotion: false,
      potionIds: [],
      hpLimiar: 0.3,
      autoVoltarHunt: false,
      pvpAutoFila: false,
    });
    expect(a.aoSpawn(99)).toBe('espera');
    c.estado.agora = 6000;
    c.estado.jogador = jogador({ automacao: lerAutomacao({ autoBallAteCapturar: true }) });
    expect(a.aoSpawn(99)).toBe('ja-ligado');
  });

  it('não envia nada sem VIP ou sem bola', () => {
    const sem = contexto(jogador({ vip: false }));
    expect(new AutoBallDex(sem.ctx).aoSpawn(99)).toBe('sem-vip');
    const semBola = contexto(jogador({ bolas: {} }));
    expect(new AutoBallDex(semBola.ctx).aoSpawn(99)).toBe('sem-bola');
    expect([...sem.enviados, ...semBola.enviados]).toHaveLength(0);
  });

  it('monta o pacote igual ao do jogo', () => {
    expect(pacoteAutoSet(lerAutomacao({}), { autoPotion: true })).toMatchObject({
      t: 'auto.set',
      autoPotion: true,
    });
  });
});

describe('fallback de captura pelos caídos', () => {
  function dom(linhas: [string, string][]) {
    const raiz = document.createElement('div');
    raiz.innerHTML = `<div id="caidos-lista">${linhas
      .map(
        ([slot, nome]) =>
          `<button class="caido" data-slot="${slot}"><span class="caido-quem">${nome} <b>Nv230</b></span></button>`,
      )
      .join('')}</div>`;
    const cliques: string[] = [];
    for (const b of raiz.querySelectorAll('.caido'))
      b.addEventListener('click', () => cliques.push((b as HTMLElement).dataset.slot!));
    return { doc: raiz, cliques };
  }

  it('clica só em espécies fora da pokédex, uma por intervalo', () => {
    const { doc, cliques } = dom([
      ['1', 'Pineco'],
      ['2', 'Sunkern'],
      ['3', 'Desconhecido'],
    ]);
    const c = contexto(jogador({ vip: false, especiesCapturadas: new Set([204]) }));
    const porNome = new Map([
      ['pineco', 204],
      ['sunkern', 191],
    ]);
    const cc = new CapturaCaidos(c.ctx, doc, (n) => porNome.get(n.toLowerCase()));
    expect(cc.tique()).toBe('Sunkern');
    expect(cc.tique()).toBeNull();
    c.estado.agora = 2000;
    cc.tique();
    expect(cliques).toEqual(['2', '2']);
  });

  it('desiste depois do máximo de cliques no mesmo caído', () => {
    const { doc, cliques } = dom([['1', 'Sunkern']]);
    const c = contexto(jogador({ vip: false, especiesCapturadas: new Set() }));
    const cc = new CapturaCaidos(c.ctx, doc, () => 191);
    for (let i = 0; i < 30; i++) {
      c.estado.agora = i * 2000;
      cc.tique();
    }
    expect(cliques).toHaveLength(15);
  });
});

describe('reposição', () => {
  const precos: Record<string, number> = { 'ball:1': 100, 'item:5': 50 };
  function preparar(j: Jogador, reserva = 0) {
    const c = contexto(j);
    const r = new Reposicao(c.ctx, {
      regras: () => [regraPadrao('ball', 1), regraPadrao('item', 5), regraPadrao('ball', 9)],
      reservaGold: () => reserva,
      preco: (k, id) => precos[`${k}:${id}`],
    });
    return { c, r };
  }

  it('compra até o alvo quando o estoque fica abaixo do mínimo', () => {
    const { c, r } = preparar(jogador({ bolas: { '1': 150 }, itens: { '5': 999 } }));
    expect(r.tique()).toEqual({ kind: 'ball', id: 1, qty: 850, custo: 85_000 });
    expect(c.enviados).toEqual([{ t: 'shop.buy', kind: 'ball', id: 1, qty: 850 }]);
  });

  it('respeita a reserva de gold, a espera entre compras e itens sem preço', () => {
    const { c, r } = preparar(
      jogador({ gold: 30_000, bolas: { '1': 0 }, itens: { '5': 300 } }),
      10_000,
    );
    expect(r.tique()?.qty).toBe(200);
    expect(r.tique()).toBeNull();
    c.estado.agora = 30_000;
    expect(r.tique()?.qty).toBe(200);
    const pobre = preparar(jogador({ gold: 40, bolas: { '1': 0 } }));
    expect(pobre.r.tique()).toBeNull();
    expect(pobre.c.memoria.entradas.filter((e) => e.nivel === 'WARN')).toHaveLength(3);
  });
});

describe('melhor ativo', () => {
  it('troca uma vez ao entrar na hunt e respeita a espera', () => {
    const c = contexto(jogador({ huntSlug: 'a', activeId: '1' }));
    const m = new MelhorAtivo(c.ctx, (slug) => (slug === 'a' ? '2' : '1'));
    expect(m.tique()).toBe('2');
    expect(m.tique()).toBeNull();
    c.estado.jogador = jogador({ huntSlug: 'a', activeId: '2' });
    c.estado.agora = 5000;
    expect(m.tique()).toBeNull();
    c.estado.jogador = jogador({ huntSlug: 'b', activeId: '2' });
    expect(m.tique()).toBe('1');
    expect(c.enviados).toEqual([
      { t: 'team.active', pokemonId: '2' },
      { t: 'team.active', pokemonId: '1' },
    ]);
  });

  it('não troca no centro nem quando o melhor já é o ativo', () => {
    const c = contexto(jogador({ noCentro: true }));
    const m = new MelhorAtivo(c.ctx, () => '2');
    expect(m.tique()).toBeNull();
    const c2 = contexto(jogador({ activeId: '2' }));
    expect(new MelhorAtivo(c2.ctx, () => '2').tique()).toBeNull();
  });
});

describe('rotação de hunts', () => {
  const hunts: CandidataRotacao[] = [
    { slug: 'h100', nivel: 100, lucroH: 500, xpH: 10, goldH: 600 },
    { slug: 'h150', nivel: 150, lucroH: 900, xpH: 5, goldH: 900 },
    { slug: 'h200', nivel: 200, lucroH: 700, xpH: 30, goldH: 800 },
  ];

  it('escolhe pela regra entre as liberadas', () => {
    expect(escolherHunt(hunts, 199, 'lucro')?.slug).toBe('h150');
    expect(escolherHunt(hunts, 200, 'xp')?.slug).toBe('h200');
    expect(escolherHunt(hunts, 200, 'nivel')?.slug).toBe('h200');
    expect(escolherHunt(hunts, 50, 'lucro')).toBeNull();
  });

  it('só viaja quando o nível libera uma hunt nova', () => {
    const c = contexto(jogador({ level: 149, huntSlug: 'h100' }));
    const destinos: string[] = [];
    const r = new Rotacao(c.ctx, {
      criterio: () => 'lucro',
      candidatas: () => hunts,
      viajar: (s) => destinos.push(s),
    });
    expect(r.tique()).toBeNull();
    c.estado.jogador = jogador({ level: 150, huntSlug: 'h100' });
    expect(r.tique()).toBe('h150');
    c.estado.jogador = jogador({ level: 151, huntSlug: 'h150' });
    expect(r.tique()).toBeNull();
    expect(destinos).toEqual(['h150']);
  });
});

describe('serviço de automação', () => {
  function servico(prefs: Partial<PreferenciasAutomacao>, j = jogador()) {
    const { log } = logDeTeste();
    const postados: EnvelopeComando[] = [];
    let agora = 0;
    const s = new ServicoAutomacao({
      preferencias: () => ({ ...PREFERENCIAS_AUTOMACAO_PADRAO, ...prefs }),
      jogador: () => j,
      postar: (e) => postados.push(e),
      preco: () => 100,
      melhorDaHunt: () => null,
      candidatasRotacao: () => [],
      especiePorNome: () => undefined,
      dom: { querySelectorAll: () => [] },
      agora: () => agora,
      log,
    });
    return { s, postados, avancar: (ms: number) => (agora += ms) };
  }

  it('com a chave geral desligada não envia nada', () => {
    const { s, postados } = servico({
      autoBallDex: true,
      reposicao: { ligada: true, reservaGold: 0, regras: [regraPadrao('ball', 1)] },
    });
    expect(s.viajar('b')).toBe(false);
    s.aoEventosBatalha([{ k: 'spawn', speciesId: 99 }]);
    s.tique();
    expect(postados).toHaveLength(0);
  });

  it('com a chave ligada viaja, liga a bola e repõe', () => {
    const { s, postados } = servico({
      ligada: true,
      autoBallDex: true,
      reposicao: { ligada: true, reservaGold: 0, regras: [regraPadrao('ball', 1)] },
    });
    expect(s.viajar('b')).toBe(true);
    s.aoEventosBatalha([{ k: 'spawn', speciesId: 99 }, { k: 'morte' }, null]);
    s.tique();
    expect(postados.map((p) => (p.comando as Comando).t)).toEqual([
      'hunt.select',
      'auto.set',
      'shop.buy',
    ]);
    expect(s.modelo()).toMatchObject({ ligada: true, viagem: { alvo: 'b' } });
    s.aoResultado({ id: 1, t: 'hunt.select', enviado: true });
    expect(s.modelo().comandos.at(-1)?.situacao).toBe('confirmado');
    s.cancelarViagem();
    expect(s.modelo().ultimaViagem?.fim).toBe('cancelada');
  });
});

describe('itens compráveis e ações do painel', () => {
  it('lista bolas e itens de cura/revive com preço, com o estoque do jogador', async () => {
    const { EstadoJogo } = await import('../../src/domain/estadoJogo');
    const { CatalogoItens } = await import('../../src/domain/catalogo');
    const { itensCompraveis, montarAcoesAutomacao } =
      await import('../../src/content/automacao/acoesAutomacao');
    const { log } = logDeTeste();
    const estado = new EstadoJogo(log);
    estado.aplicarMensagem({
      t: 'welcome',
      estado: { cheio: true, nick: 'a', balls: { '2': 7 }, items: { '11': 3 } },
      catalogoBolas: [
        { id: 1, name: 'Poke Ball', priceGold: 50 },
        { id: 2, name: 'Great Ball', priceGold: 300 },
        { id: 3, name: 'Master', priceGold: 0 },
        { id: 4, name: 'Premium', priceGold: 10, compravel: false },
      ],
      itensNossos: [{ id: 11, name: 'Potion', category: 'heal', npcPrice: 20 }],
    });
    const catalogo = new CatalogoItens();
    catalogo.adicionar([
      { id: 11, name: 'Potion dup', category: 'heal', npcPrice: 99 },
      { id: 12, name: 'Revive', category: 'revive', npcPrice: 500 },
      { id: 13, name: 'Pedra', category: 'stone', npcPrice: 5 },
    ]);
    const lista = itensCompraveis(estado, catalogo);
    expect(lista.map((i) => `${i.kind}:${i.id}:${i.preco}:${i.estoque}`)).toEqual([
      'ball:1:50:0',
      'ball:2:300:7',
      'item:11:20:3',
      'item:12:500:0',
    ]);
    const servico = {
      modelo: () => ({ ligada: true }),
      viajar: (s: string) => s === 'ok',
      cancelarViagem: () => undefined,
    } as unknown as ServicoAutomacao;
    let salvo: PreferenciasAutomacao | null = null;
    const acoes = montarAcoesAutomacao({
      servico,
      estado,
      itens: catalogo,
      preferencias: () => PREFERENCIAS_AUTOMACAO_PADRAO,
      salvar: (p) => {
        salvo = p;
      },
    });
    expect(acoes.viajar('ok')).toBe(true);
    expect(acoes.modelo().ligada).toBe(true);
    acoes.cancelarViagem();
    acoes.salvar(PREFERENCIAS_AUTOMACAO_PADRAO);
    expect(salvo).toBe(PREFERENCIAS_AUTOMACAO_PADRAO);
    expect(acoes.itensCompraveis()).toHaveLength(4);
  });
});
