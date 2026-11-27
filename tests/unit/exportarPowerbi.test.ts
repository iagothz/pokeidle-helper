import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { paraCsv } from '../../scripts/powerbi/csv.mjs';
import { BOM, executar, interpretarArgumentos } from '../../scripts/powerbi/cli.mjs';
import {
  ErroEntrada,
  PRECOS_BOLAS,
  lerCatalogoItens,
  lerSessoesDoBackup,
  montarModelo,
} from '../../scripts/powerbi/modelo.mjs';

const H = 3_600_000;
const T0 = Date.UTC(2026, 10, 27, 12, 0, 0);

const itensJson = {
  items: [
    { id: 76, name: 'Leaf Stone', category: 'stone', rare: true, npcPrice: 5000 },
    { id: 202, name: 'Ultra Potion', category: 'heal', npcPrice: 400, priceGold: 22 },
    { id: 205, name: 'Revive', category: 'revive', npcPrice: 600, priceGold: 40 },
    { id: 70000, name: 'Bronze Boss Token', category: 'loot', npcPrice: 250000 },
  ],
};

function sessao(extra: Record<string, unknown> = {}) {
  return {
    id: 'sunflora-1',
    schemaVersion: 5,
    huntSlug: 'sunflora',
    huntNome: 'Sunflora',
    inicio: T0,
    fim: T0 + H,
    msAtivo: H,
    xpTreinador: 1000,
    xpPokemon: 900,
    gold: 5000,
    abates: 10,
    capturas: 2,
    shiniesVistos: 0,
    shinies: 0,
    bolas: { '4': 10 },
    pocoes: { '202': 5 },
    revives: { '205': 1 },
    tokens: {},
    drops: { 'nome:Leaf Stone': { nome: 'Leaf Stone', qtd: 2 } },
    spawns: {},
    golpesRecebidos: 30,
    golpesSuperEfetivos: 1,
    danoRecebido: 3000,
    desmaios: 1,
    xpPerdido: 0,
    fugas: 8,
    vendasAuto: 100_000,
    golpesDados: 40,
    danoCausado: 50_000,
    fases: { lutaMs: 0.5 * H, deslocamentoMs: 0.4 * H, esperaMs: 0.1 * H, ondas: 4 },
    pokemon: { id: '42', speciesId: 6, level: 300, levelFinal: 301 },
    sazonal: { tipo: 'FIRE', escudo: true },
    trechos: [
      {
        inicio: T0,
        fim: T0 + H / 2,
        pokemonId: '42',
        level: 300,
        tipoSazonal: 'FIRE',
        msAtivo: H / 2,
        abates: 6,
        golpesDados: 24,
        danoCausado: 30_000,
        xpPokemon: 540,
        gold: 3000,
        desmaios: 1,
        fases: { lutaMs: 1000, deslocamentoMs: 800, esperaMs: 200, ondas: 2 },
      },
      {
        inicio: T0 + H / 2,
        fim: T0 + H,
        pokemonId: '42',
        level: 301,
        msAtivo: H / 2,
        abates: 4,
        golpesDados: 16,
        danoCausado: 20_000,
        xpPokemon: 360,
        gold: 2000,
        desmaios: 0,
        fases: { lutaMs: 900, deslocamentoMs: 700, esperaMs: 100, ondas: 2 },
      },
    ],
    abatesDetalhe: [
      { t: T0 + 1000, lv: 300, g: 4, d: 5000, l: 2000, xp: 90, o: 500 },
      { t: T0 + H / 2 + 1000, g: 3, d: 4000, l: 1500, xp: 90, o: 500 },
    ],
    consumo: [
      { t: T0 + 500, k: 'pocao', id: 202 },
      { t: T0 + 600, k: 'bola', id: 4 },
      { t: T0 + 700, k: 'revive', id: 205 },
      { t: T0 + 800, k: 'desmaio' },
      { t: T0 + H / 2 + 10, k: 'captura', sp: 192, lv: 100, q: 1.028, v: 54963, shiny: true },
      { t: T0 + 2 * H, k: 'bola', id: 99 },
    ],
    aberta: false,
    ...extra,
  };
}

function backup(sessoes: unknown[]) {
  return { formato: 'pokeidle-helper-backup', versao: '0.11.0', sessoes };
}

function modelo(sessoes: unknown[] = [sessao()]) {
  const lidas = lerSessoesDoBackup(backup(sessoes));
  return montarModelo(lidas.sessoes, lerCatalogoItens(itensJson), { fuso: 'UTC' });
}

function linhas(nome: string, sessoes?: unknown[]) {
  const t = modelo(sessoes).tabelas[nome]!;
  return t.linhas.map((l) => Object.fromEntries(t.colunas.map((c, i) => [c, l[i]])));
}

describe('lerSessoesDoBackup', () => {
  it('recusa arquivos que não são backup do helper', () => {
    expect(() => lerSessoesDoBackup({ formato: 'outro', sessoes: [] })).toThrow(ErroEntrada);
    expect(() => lerSessoesDoBackup(null)).toThrow(/backup/);
    expect(() => lerSessoesDoBackup({ formato: 'pokeidle-helper-backup' })).toThrow(/sessoes/);
  });

  it('descarta sessões inválidas com aviso e preenche campos ausentes', () => {
    const r = lerSessoesDoBackup(
      backup([{ id: 'x' }, { ...sessao(), trechos: undefined, consumo: undefined }]),
    );
    expect(r.sessoes).toHaveLength(1);
    expect(r.sessoes[0]!.trechos).toEqual([]);
    expect(r.sessoes[0]!.consumo).toEqual([]);
    expect(r.avisos).toEqual([expect.stringContaining('posição 0')]);
  });

  it('com sessões repetidas entre partes fica com a mais longa', () => {
    const lidas = lerSessoesDoBackup(backup([sessao({ msAtivo: 10 }), sessao()]));
    const m = montarModelo(lidas.sessoes, new Map(), { fuso: 'UTC' });
    expect(m.tabelas.fato_sessao!.linhas).toHaveLength(1);
    expect(m.tabelas.fato_sessao!.linhas[0]).toContain(H);
  });
});

describe('lerCatalogoItens', () => {
  it('aceita lista direta ou objeto com items e normaliza preços', () => {
    const c = lerCatalogoItens([{ id: '202', name: 'Ultra Potion', priceGold: 22 }]);
    expect(c.get(202)).toMatchObject({ nome: 'Ultra Potion', precoNpc: 0, precoCompra: 22 });
    expect(lerCatalogoItens(itensJson).get(76)).toMatchObject({ categoria: 'stone', raro: true });
  });

  it('recusa catálogo vazio', () => {
    expect(() => lerCatalogoItens({ outra: [] })).toThrow(ErroEntrada);
  });
});

describe('montarModelo', () => {
  it('gera todas as tabelas do esquema estrela', () => {
    expect(Object.keys(modelo().tabelas).sort()).toEqual([
      'dim_bola',
      'dim_hunt',
      'dim_item',
      'dim_sessao',
      'dim_tempo',
      'fato_abate',
      'fato_consumo',
      'fato_drop',
      'fato_sessao',
      'fato_trecho',
    ]);
  });

  it('calcula custos e lucro líquido da sessão', () => {
    const [s] = linhas('fato_sessao');
    expect(s).toMatchObject({
      sessao_id: 'sunflora-1',
      hunt_id: 'sunflora',
      data_id: 20261127,
      bolas_usadas: 10,
      custo_bolas: 1300,
      pocoes_usadas: 5,
      custo_pocoes: 110,
      revives_usados: 1,
      custo_revives: 40,
      valor_drops: 10_000,
      lucro_liquido: 5000 + 100_000 + 10_000 - 1300 - 110 - 40,
      fases_medidas: true,
    });
  });

  it('marca sessão sem fases medidas', () => {
    const [s] = linhas('fato_sessao', [
      sessao({ fases: { lutaMs: 0, deslocamentoMs: 0, esperaMs: 0, ondas: 0 } }),
    ]);
    expect(s!.fases_medidas).toBe(false);
  });

  it('descreve a sessão na dimensão com níveis e sazonal', () => {
    const [d] = linhas('dim_sessao');
    expect(d).toMatchObject({
      sessao_id: 'sunflora-1',
      rotulo: 'Sunflora 27/11 12:00',
      inicio: '2026-11-27 12:00:00',
      especie_id: 6,
      nivel_inicial: 300,
      nivel_final: 301,
      tipo_sazonal: 'FIRE',
      escudo_sazonal: true,
      tem_detalhe: true,
    });
  });

  it('gera um trecho por nível herdando o sazonal da sessão', () => {
    const t = linhas('fato_trecho');
    expect(t.map((x) => [x.trecho_seq, x.nivel, x.tipo_sazonal, x.abates])).toEqual([
      [1, 300, 'FIRE', 6],
      [2, 301, 'FIRE', 4],
    ]);
    expect(t[0]).toMatchObject({ luta_ms: 1000, deslocamento_ms: 800, espera_ms: 200, ondas: 2 });
  });

  it('completa o nível do abate pelo trecho quando falta', () => {
    const a = linhas('fato_abate');
    expect(a.map((x) => [x.nivel, x.golpes, x.dano, x.duracao_ms, x.xp, x.gold])).toEqual([
      [300, 4, 5000, 2000, 90, 500],
      [301, 3, 4000, 1500, 90, 500],
    ]);
    expect(a[0]!.momento).toBe('2026-11-27 12:00:01');
    expect(a[0]!.hora).toBe(12);
  });

  it('classifica o consumo com custo, chaves de bola e item e dados da captura', () => {
    const c = linhas('fato_consumo');
    expect(c.map((x) => [x.tipo, x.bola_id, x.item_id, x.custo, x.nivel])).toEqual([
      ['pocao', null, 202, 22, 300],
      ['bola', 4, null, 130, 300],
      ['revive', null, 205, 40, 300],
      ['desmaio', null, null, 0, 300],
      ['captura', null, null, 0, 301],
      ['bola', 99, null, 0, null],
    ]);
    expect(c[4]).toMatchObject({
      especie_id: 192,
      nivel_capturado: 100,
      qualidade: 1.028,
      shiny: true,
      valor_venda_auto: 54963,
    });
  });

  it('resolve drops por nome no catálogo e avisa os desconhecidos', () => {
    const m = montarModelo(
      lerSessoesDoBackup(
        backup([
          sessao({ drops: { '76': { qtd: 1 }, 'nome:Pedra X': { nome: 'Pedra X', qtd: 3 } } }),
        ]),
      ).sessoes,
      lerCatalogoItens(itensJson),
      { fuso: 'UTC' },
    );
    const t = m.tabelas.fato_drop!;
    const rows = t.linhas.map((l) => Object.fromEntries(t.colunas.map((c, i) => [c, l[i]])));
    expect(rows.map((r) => [r.item_id, r.item_nome, r.quantidade, r.valor_npc])).toEqual([
      [76, 'Leaf Stone', 1, 5000],
      [null, 'Pedra X', 3, 0],
    ]);
    expect(m.avisos).toEqual([
      expect.stringContaining('Pedra X'),
      expect.stringContaining('bola 99'),
    ]);
  });

  it('cobre todos os dias das sessões no calendário', () => {
    const d = linhas('dim_tempo', [sessao(), sessao({ id: 'b', inicio: T0 + 49 * H })]);
    expect(d.map((x) => x.data_id)).toEqual([20261127, 20261128, 20261129]);
    expect(d[0]).toMatchObject({ ano: 2026, mes: 11, ano_mes: '2026-11', dia_semana: 5 });
    expect(d[0]!.dia_semana_nome).toBe('sexta-feira');
  });

  it('usa o fuso informado nas datas', () => {
    const lidas = lerSessoesDoBackup(backup([sessao({ inicio: Date.UTC(2026, 10, 27, 1) })]));
    const m = montarModelo(lidas.sessoes, new Map(), { fuso: 'America/Sao_Paulo' });
    expect(m.tabelas.fato_sessao!.linhas[0]).toContain(20261126);
  });

  it('lista bolas fixas e itens do catálogo nas dimensões', () => {
    expect(linhas('dim_bola').map((b) => [b.bola_id, b.preco])).toEqual(
      PRECOS_BOLAS.map((b) => [b.id, b.preco]),
    );
    expect(linhas('dim_item').find((i) => i.item_id === 202)).toMatchObject({
      nome: 'Ultra Potion',
      preco_npc: 400,
      preco_compra: 22,
    });
    expect(linhas('dim_hunt')).toEqual([{ hunt_id: 'sunflora', hunt_nome: 'Sunflora' }]);
  });
});

describe('paraCsv', () => {
  it('escapa texto, usa ponto decimal e deixa nulos vazios', () => {
    expect(paraCsv(['a', 'b', 'c', 'd'], [['x,"y"', 1.5, null, true]])).toBe(
      'a,b,c,d\r\n"x,""y""",1.5,,true\r\n',
    );
  });
});

describe('interpretarArgumentos', () => {
  it('lê backups, saída, itens e fuso', () => {
    expect(
      interpretarArgumentos([
        'a.json',
        'b.json',
        '--saida',
        'out',
        '--itens',
        'i.json',
        '--fuso',
        'UTC',
      ]),
    ).toEqual({ backups: ['a.json', 'b.json'], saida: 'out', itens: 'i.json', fuso: 'UTC' });
  });

  it('exige backup e saída e recusa opção desconhecida', () => {
    expect(() => interpretarArgumentos(['--saida', 'x'])).toThrow(/backup/);
    expect(() => interpretarArgumentos(['a.json'])).toThrow(/--saida/);
    expect(() => interpretarArgumentos(['a.json', '--saida'])).toThrow(/--saida/);
    expect(() => interpretarArgumentos(['a.json', '--zzz', '1'])).toThrow(/--zzz/);
  });
});

describe('executar', () => {
  let dir: string;
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it('grava os CSVs com BOM e o log da exportação', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'pbi-'));
    const arqBackup = path.join(dir, 'backup.json');
    const arqItens = path.join(dir, 'items.json');
    await writeFile(arqBackup, JSON.stringify(backup([sessao()])));
    await writeFile(arqItens, JSON.stringify(itensJson));
    const saida = path.join(dir, 'saida');
    const r = await executar(
      { backups: [arqBackup], saida, itens: arqItens, fuso: 'UTC' },
      { raizRepo: path.join(dir, 'repo'), saidaErro: { write: () => true } },
    );
    expect(r.sessoes).toBe(1);
    const arquivos = await readdir(saida);
    expect(arquivos).toEqual(expect.arrayContaining(['fato_sessao.csv', 'exportacao.log']));
    const csv = await readFile(path.join(saida, 'fato_sessao.csv'), 'utf8');
    expect(csv.startsWith(`${BOM}sessao_id,`)).toBe(true);
    const log = await readFile(path.join(saida, 'exportacao.log'), 'utf8');
    expect(JSON.parse(log.trim().split('\n').at(-1)!)).toMatchObject({
      nivel: 'INFO',
      modulo: 'exportar-powerbi',
    });
  });

  it('recusa saída dentro do repositório', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'pbi-'));
    await expect(
      executar(
        { backups: ['x'], saida: path.join(dir, 'out'), itens: 'i', fuso: 'UTC' },
        { raizRepo: dir },
      ),
    ).rejects.toThrow(/fora do repositório/);
  });
});
