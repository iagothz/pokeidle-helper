export const FORMATO_BACKUP = 'pokeidle-helper-backup';

export const PRECOS_BOLAS = Object.freeze([
  { id: 1, nome: 'Poke Ball', preco: 5 },
  { id: 2, nome: 'Great Ball', preco: 20 },
  { id: 3, nome: 'Quick Ball', preco: 50 },
  { id: 4, nome: 'Ultra Ball', preco: 130 },
]);

const DIAS_SEMANA = [
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
  'domingo',
];

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

const TIPOS_CONSUMO = new Set(['pocao', 'revive', 'bola', 'captura', 'desmaio']);

export class ErroEntrada extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = 'ErroEntrada';
  }
}

const ehObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const numero = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const opcional = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const positivo = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
const lista = (v) => (Array.isArray(v) ? v : []);
const mapa = (v) => (ehObjeto(v) ? v : {});

function fasesDe(f) {
  const o = mapa(f);
  return {
    lutaMs: numero(o.lutaMs),
    deslocamentoMs: numero(o.deslocamentoMs),
    esperaMs: numero(o.esperaMs),
    ondas: numero(o.ondas),
  };
}

function sessaoValida(s) {
  return (
    ehObjeto(s) &&
    typeof s.id === 'string' &&
    s.id.length > 0 &&
    typeof s.huntSlug === 'string' &&
    s.huntSlug.length > 0 &&
    typeof s.inicio === 'number' &&
    Number.isFinite(s.inicio)
  );
}

function normalizarSessao(s) {
  return {
    ...s,
    huntNome: typeof s.huntNome === 'string' && s.huntNome ? s.huntNome : s.huntSlug,
    fim: Math.max(s.inicio, numero(s.fim)),
    bolas: mapa(s.bolas),
    pocoes: mapa(s.pocoes),
    revives: mapa(s.revives),
    tokens: mapa(s.tokens),
    drops: mapa(s.drops),
    fases: fasesDe(s.fases),
    pokemon: ehObjeto(s.pokemon) ? s.pokemon : null,
    sazonal: ehObjeto(s.sazonal) ? s.sazonal : null,
    trechos: lista(s.trechos).filter(ehObjeto),
    abatesDetalhe: lista(s.abatesDetalhe).filter((a) => ehObjeto(a) && Number.isFinite(a.t)),
    consumo: lista(s.consumo).filter(
      (c) => ehObjeto(c) && Number.isFinite(c.t) && TIPOS_CONSUMO.has(c.k),
    ),
    aberta: s.aberta === true,
  };
}

export function lerSessoesDoBackup(json) {
  if (!ehObjeto(json) || json.formato !== FORMATO_BACKUP) {
    throw new ErroEntrada(`O arquivo não é um backup do PokeIdle Helper (${FORMATO_BACKUP}).`);
  }
  if (!Array.isArray(json.sessoes)) {
    throw new ErroEntrada('O backup não tem a lista "sessoes".');
  }
  const avisos = [];
  const sessoes = [];
  json.sessoes.forEach((s, i) => {
    if (sessaoValida(s)) sessoes.push(normalizarSessao(s));
    else avisos.push(`Sessão inválida na posição ${i} ignorada.`);
  });
  return { sessoes, avisos };
}

export function lerCatalogoItens(json) {
  const itens = Array.isArray(json) ? json : ehObjeto(json) ? json.items : undefined;
  if (!Array.isArray(itens) || itens.length === 0) {
    throw new ErroEntrada('O catálogo de itens está vazio ou num formato inesperado.');
  }
  const catalogo = new Map();
  for (const it of itens) {
    if (!ehObjeto(it)) continue;
    const id = Number(it.id);
    if (!Number.isInteger(id) || id <= 0) continue;
    catalogo.set(id, {
      id,
      nome: typeof it.name === 'string' ? it.name : `Item ${id}`,
      categoria: typeof it.category === 'string' ? it.category : null,
      precoNpc: numero(Number(it.npcPrice)),
      precoCompra: numero(Number(it.priceGold)),
      raro: it.rare === true,
    });
  }
  return catalogo;
}

function relogio(fuso) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  return (ms) => {
    const p = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
    return {
      data: `${p.year}-${p.month}-${p.day}`,
      momento: `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`,
      dataId: Number(`${p.year}${p.month}${p.day}`),
      hora: Number(p.hour),
      rotulo: `${p.day}/${p.month} ${p.hour}:${p.minute}`,
    };
  };
}

function deduplicar(sessoes) {
  const porId = new Map();
  for (const s of sessoes) {
    const atual = porId.get(s.id);
    if (!atual || numero(s.msAtivo) > numero(atual.msAtivo)) porId.set(s.id, s);
  }
  return [...porId.values()].sort((a, b) => a.inicio - b.inicio);
}

function tabela(colunas) {
  return { colunas, linhas: [] };
}

function inserir(t, registro) {
  t.linhas.push(t.colunas.map((c) => (registro[c] === undefined ? null : registro[c])));
}

function somaMapa(m) {
  return Object.values(m).reduce((s, q) => s + numero(q), 0);
}

function custoMapa(m, preco) {
  return Object.entries(m).reduce((s, [id, q]) => s + numero(q) * preco(Number(id)), 0);
}

function nivelNoMomento(trechos, t) {
  const tr = trechos.find((x) => numero(x.inicio) <= t && t <= numero(x.fim));
  return tr ? opcional(tr.level) : null;
}

const COLUNAS = {
  dim_hunt: ['hunt_id', 'hunt_nome'],
  dim_bola: ['bola_id', 'nome', 'preco'],
  dim_item: ['item_id', 'nome', 'categoria', 'preco_npc', 'preco_compra', 'raro'],
  dim_tempo: [
    'data_id',
    'data',
    'ano',
    'mes',
    'mes_nome',
    'ano_mes',
    'dia',
    'dia_semana',
    'dia_semana_nome',
  ],
  dim_sessao: [
    'sessao_id',
    'rotulo',
    'inicio',
    'fim',
    'pokemon_id',
    'especie_id',
    'nivel_inicial',
    'nivel_final',
    'tipo_sazonal',
    'escudo_sazonal',
    'aberta',
    'fases_medidas',
    'tem_detalhe',
  ],
  fato_sessao: [
    'sessao_id',
    'hunt_id',
    'data_id',
    'hora',
    'ms_ativo',
    'abates',
    'capturas',
    'shinies_vistos',
    'shinies',
    'xp_pokemon',
    'xp_treinador',
    'gold',
    'vendas_auto',
    'valor_drops',
    'golpes_dados',
    'dano_causado',
    'golpes_recebidos',
    'golpes_super_efetivos',
    'dano_recebido',
    'desmaios',
    'xp_perdido',
    'fugas',
    'luta_ms',
    'deslocamento_ms',
    'espera_ms',
    'ondas',
    'fases_medidas',
    'bolas_usadas',
    'custo_bolas',
    'pocoes_usadas',
    'custo_pocoes',
    'revives_usados',
    'custo_revives',
    'tokens_usados',
    'lucro_liquido',
  ],
  fato_trecho: [
    'sessao_id',
    'hunt_id',
    'data_id',
    'trecho_seq',
    'pokemon_id',
    'nivel',
    'tipo_sazonal',
    'inicio',
    'fim',
    'ms_ativo',
    'abates',
    'golpes_dados',
    'dano_causado',
    'xp_pokemon',
    'gold',
    'desmaios',
    'luta_ms',
    'deslocamento_ms',
    'espera_ms',
    'ondas',
  ],
  fato_abate: [
    'sessao_id',
    'hunt_id',
    'data_id',
    'abate_seq',
    'momento',
    'hora',
    'nivel',
    'golpes',
    'dano',
    'duracao_ms',
    'xp',
    'gold',
  ],
  fato_consumo: [
    'sessao_id',
    'hunt_id',
    'data_id',
    'consumo_seq',
    'momento',
    'hora',
    'nivel',
    'tipo',
    'bola_id',
    'item_id',
    'quantidade',
    'custo',
    'especie_id',
    'nivel_capturado',
    'qualidade',
    'shiny',
    'valor_venda_auto',
  ],
  fato_drop: ['sessao_id', 'hunt_id', 'data_id', 'item_id', 'item_nome', 'quantidade', 'valor_npc'],
};

function criarResolvedores(catalogo, avisos) {
  const precoBola = new Map(PRECOS_BOLAS.map((b) => [b.id, b.preco]));
  const porNome = new Map([...catalogo.values()].map((i) => [i.nome.toLowerCase(), i]));
  const avisados = new Set();
  const avisar = (chave, texto) => {
    if (avisados.has(chave)) return;
    avisados.add(chave);
    avisos.push(texto);
  };
  return {
    bola(id) {
      if (!precoBola.has(id)) avisar(`bola:${id}`, `Preço da bola ${id} desconhecido; custo 0.`);
      return precoBola.get(id) ?? 0;
    },
    compra(id) {
      return catalogo.get(id)?.precoCompra ?? 0;
    },
    drop(chave, registro) {
      const id = Number(chave);
      const nome = chave.startsWith('nome:') ? chave.slice(5) : registro.nome;
      const item =
        Number.isInteger(id) && id > 0
          ? catalogo.get(id)
          : nome
            ? porNome.get(nome.toLowerCase())
            : undefined;
      if (!item) avisar(`drop:${chave}`, `Drop "${nome ?? chave}" fora do catálogo; valor 0.`);
      return item ?? null;
    },
  };
}

function registrarSessao(t, s, quando, resolver) {
  const valorDrops = [];
  for (const [chave, d] of Object.entries(s.drops)) {
    const registro = mapa(d);
    const item = resolver.drop(chave, registro);
    const qtd = numero(registro.qtd);
    valorDrops.push(qtd * (item?.precoNpc ?? 0));
    inserir(t.fato_drop, {
      sessao_id: s.id,
      hunt_id: s.huntSlug,
      data_id: quando.dataId,
      item_id: item?.id ?? null,
      item_nome: item?.nome ?? registro.nome ?? chave.replace(/^nome:/, ''),
      quantidade: qtd,
      valor_npc: qtd * (item?.precoNpc ?? 0),
    });
  }
  const custoBolas = custoMapa(s.bolas, resolver.bola);
  const custoPocoes = custoMapa(s.pocoes, resolver.compra);
  const custoRevives = custoMapa(s.revives, resolver.compra);
  const drops = valorDrops.reduce((a, b) => a + b, 0);
  const fasesMedidas = s.fases.lutaMs + s.fases.deslocamentoMs + s.fases.esperaMs > 0;
  inserir(t.fato_sessao, {
    sessao_id: s.id,
    hunt_id: s.huntSlug,
    data_id: quando.dataId,
    hora: quando.hora,
    ms_ativo: numero(s.msAtivo),
    abates: numero(s.abates),
    capturas: numero(s.capturas),
    shinies_vistos: numero(s.shiniesVistos),
    shinies: numero(s.shinies),
    xp_pokemon: numero(s.xpPokemon),
    xp_treinador: numero(s.xpTreinador),
    gold: numero(s.gold),
    vendas_auto: numero(s.vendasAuto),
    valor_drops: drops,
    golpes_dados: numero(s.golpesDados),
    dano_causado: numero(s.danoCausado),
    golpes_recebidos: numero(s.golpesRecebidos),
    golpes_super_efetivos: numero(s.golpesSuperEfetivos),
    dano_recebido: numero(s.danoRecebido),
    desmaios: numero(s.desmaios),
    xp_perdido: numero(s.xpPerdido),
    fugas: numero(s.fugas),
    luta_ms: s.fases.lutaMs,
    deslocamento_ms: s.fases.deslocamentoMs,
    espera_ms: s.fases.esperaMs,
    ondas: s.fases.ondas,
    fases_medidas: fasesMedidas,
    bolas_usadas: somaMapa(s.bolas),
    custo_bolas: custoBolas,
    pocoes_usadas: somaMapa(s.pocoes),
    custo_pocoes: custoPocoes,
    revives_usados: somaMapa(s.revives),
    custo_revives: custoRevives,
    tokens_usados: somaMapa(s.tokens),
    lucro_liquido:
      numero(s.gold) + numero(s.vendasAuto) + drops - custoBolas - custoPocoes - custoRevives,
  });
  return fasesMedidas;
}

function registrarDimSessao(t, s, quando, relogioLocal, fasesMedidas) {
  const pk = s.pokemon;
  const nivelInicial = opcional(pk?.level) ?? opcional(s.trechos[0]?.level);
  inserir(t.dim_sessao, {
    sessao_id: s.id,
    rotulo: `${s.huntNome} ${quando.rotulo}`,
    inicio: quando.momento,
    fim: relogioLocal(s.fim).momento,
    pokemon_id: typeof pk?.id === 'string' ? pk.id : null,
    especie_id: opcional(pk?.speciesId),
    nivel_inicial: nivelInicial,
    nivel_final: opcional(pk?.levelFinal) ?? opcional(s.trechos.at(-1)?.level) ?? nivelInicial,
    tipo_sazonal: typeof s.sazonal?.tipo === 'string' ? s.sazonal.tipo : null,
    escudo_sazonal: s.sazonal ? s.sazonal.escudo === true : null,
    aberta: s.aberta,
    fases_medidas: fasesMedidas,
    tem_detalhe: s.trechos.length + s.abatesDetalhe.length + s.consumo.length > 0,
  });
}

function registrarTrechos(t, s, quando, relogioLocal) {
  s.trechos.forEach((tr, i) => {
    const f = fasesDe(tr.fases);
    inserir(t.fato_trecho, {
      sessao_id: s.id,
      hunt_id: s.huntSlug,
      data_id: relogioLocal(numero(tr.inicio) || s.inicio).dataId,
      trecho_seq: i + 1,
      pokemon_id: typeof tr.pokemonId === 'string' ? tr.pokemonId : null,
      nivel: opcional(tr.level),
      tipo_sazonal:
        typeof tr.tipoSazonal === 'string'
          ? tr.tipoSazonal
          : typeof s.sazonal?.tipo === 'string'
            ? s.sazonal.tipo
            : null,
      inicio: relogioLocal(numero(tr.inicio) || s.inicio).momento,
      fim: relogioLocal(numero(tr.fim) || quando.fim).momento,
      ms_ativo: numero(tr.msAtivo),
      abates: numero(tr.abates),
      golpes_dados: numero(tr.golpesDados),
      dano_causado: numero(tr.danoCausado),
      xp_pokemon: numero(tr.xpPokemon),
      gold: numero(tr.gold),
      desmaios: numero(tr.desmaios),
      luta_ms: f.lutaMs,
      deslocamento_ms: f.deslocamentoMs,
      espera_ms: f.esperaMs,
      ondas: f.ondas,
    });
  });
}

function registrarAbates(t, s, relogioLocal) {
  s.abatesDetalhe.forEach((a, i) => {
    const q = relogioLocal(a.t);
    inserir(t.fato_abate, {
      sessao_id: s.id,
      hunt_id: s.huntSlug,
      data_id: q.dataId,
      abate_seq: i + 1,
      momento: q.momento,
      hora: q.hora,
      nivel: opcional(a.lv) ?? nivelNoMomento(s.trechos, a.t),
      golpes: numero(a.g),
      dano: numero(a.d),
      duracao_ms: numero(a.l),
      xp: numero(a.xp),
      gold: numero(a.o),
    });
  });
}

function custoDoConsumo(c, resolver) {
  if (c.k === 'bola') return positivo(c.id) ? resolver.bola(c.id) : 0;
  if (c.k === 'pocao' || c.k === 'revive') return positivo(c.id) ? resolver.compra(c.id) : 0;
  return 0;
}

function registrarConsumo(t, s, relogioLocal, resolver) {
  s.consumo.forEach((c, i) => {
    const q = relogioLocal(c.t);
    const captura = c.k === 'captura';
    inserir(t.fato_consumo, {
      sessao_id: s.id,
      hunt_id: s.huntSlug,
      data_id: q.dataId,
      consumo_seq: i + 1,
      momento: q.momento,
      hora: q.hora,
      nivel: nivelNoMomento(s.trechos, c.t),
      tipo: c.k,
      bola_id: c.k === 'bola' ? positivo(c.id) : null,
      item_id: c.k === 'pocao' || c.k === 'revive' ? positivo(c.id) : null,
      quantidade: 1,
      custo: custoDoConsumo(c, resolver),
      especie_id: captura ? positivo(c.sp) : null,
      nivel_capturado: captura ? positivo(c.lv) : null,
      qualidade: captura ? positivo(c.q) : null,
      shiny: captura ? c.shiny === true : null,
      valor_venda_auto: captura ? (positivo(c.v) ?? 0) : null,
    });
  });
}

function registrarCalendario(t, datas) {
  if (datas.length === 0) return;
  const paraUtc = (d) =>
    Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
  const ordenadas = [...new Set(datas)].sort();
  const fim = paraUtc(ordenadas.at(-1));
  for (let dia = paraUtc(ordenadas[0]); dia <= fim; dia += 86_400_000) {
    const d = new Date(dia);
    const ano = d.getUTCFullYear();
    const mes = d.getUTCMonth() + 1;
    const diaMes = d.getUTCDate();
    const diaSemana = ((d.getUTCDay() + 6) % 7) + 1;
    const mm = String(mes).padStart(2, '0');
    const dd = String(diaMes).padStart(2, '0');
    inserir(t.dim_tempo, {
      data_id: Number(`${ano}${mm}${dd}`),
      data: `${ano}-${mm}-${dd}`,
      ano,
      mes,
      mes_nome: MESES[mes - 1],
      ano_mes: `${ano}-${mm}`,
      dia: diaMes,
      dia_semana: diaSemana,
      dia_semana_nome: DIAS_SEMANA[diaSemana - 1],
    });
  }
}

function registrarDimensoes(t, sessoes, catalogo) {
  const hunts = new Map(sessoes.map((s) => [s.huntSlug, s.huntNome]));
  for (const [id, nome] of [...hunts].sort((a, b) => a[0].localeCompare(b[0]))) {
    inserir(t.dim_hunt, { hunt_id: id, hunt_nome: nome });
  }
  for (const b of PRECOS_BOLAS)
    inserir(t.dim_bola, { bola_id: b.id, nome: b.nome, preco: b.preco });
  for (const i of [...catalogo.values()].sort((a, b) => a.id - b.id)) {
    inserir(t.dim_item, {
      item_id: i.id,
      nome: i.nome,
      categoria: i.categoria,
      preco_npc: i.precoNpc,
      preco_compra: i.precoCompra,
      raro: i.raro,
    });
  }
}

export function montarModelo(sessoesBrutas, catalogo, { fuso }) {
  const relogioLocal = relogio(fuso);
  const avisos = [];
  const resolver = criarResolvedores(catalogo, avisos);
  const tabelas = Object.fromEntries(Object.entries(COLUNAS).map(([n, c]) => [n, tabela(c)]));
  const sessoes = deduplicar(sessoesBrutas);
  const datas = [];
  for (const s of sessoes) {
    const quando = { ...relogioLocal(s.inicio), fim: s.fim };
    datas.push(quando.data, relogioLocal(s.fim).data);
    const fasesMedidas = registrarSessao(tabelas, s, quando, resolver);
    registrarDimSessao(tabelas, s, quando, relogioLocal, fasesMedidas);
    registrarTrechos(tabelas, s, quando, relogioLocal);
    registrarAbates(tabelas, s, relogioLocal);
    registrarConsumo(tabelas, s, relogioLocal, resolver);
  }
  registrarDimensoes(tabelas, sessoes, catalogo);
  registrarCalendario(tabelas, datas);
  return { tabelas, avisos, sessoes: sessoes.length };
}
