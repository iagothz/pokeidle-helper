import { appendFile, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { paraCsv } from './csv.mjs';
import { ErroEntrada, lerCatalogoItens, lerSessoesDoBackup, montarModelo } from './modelo.mjs';

export const ITENS_PADRAO = 'https://pokeidle.io/assets/items.json';
const ARQUIVO_LOG = 'exportacao.log';
const LIMITE_LOG = 1_000_000;
export const BOM = String.fromCharCode(0xfeff);
const OPCOES = new Set(['--saida', '--itens', '--fuso']);

export function interpretarArgumentos(argv) {
  const r = {
    backups: [],
    saida: null,
    itens: ITENS_PADRAO,
    fuso: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      r.backups.push(a);
      continue;
    }
    if (!OPCOES.has(a)) throw new ErroEntrada(`Opção desconhecida: ${a}`);
    const valor = argv[++i];
    if (valor === undefined || valor.startsWith('--')) {
      throw new ErroEntrada(`A opção ${a} precisa de um valor.`);
    }
    r[a.slice(2)] = valor;
  }
  if (r.backups.length === 0) throw new ErroEntrada('Informe ao menos um arquivo de backup.');
  if (!r.saida) throw new ErroEntrada('Informe a pasta de saída com --saida.');
  try {
    new Intl.DateTimeFormat('en', { timeZone: r.fuso });
  } catch {
    throw new ErroEntrada(`Fuso horário inválido: ${r.fuso}`);
  }
  return r;
}

export function criarLogger(arquivo, saidaErro = process.stderr) {
  const registrar = async (nivel, mensagem, contexto = {}) => {
    const linha = JSON.stringify({
      ts: new Date().toISOString(),
      nivel,
      modulo: 'exportar-powerbi',
      mensagem,
      ...contexto,
    });
    saidaErro.write(`${linha}\n`);
    await appendFile(arquivo, `${linha}\n`, 'utf8');
  };
  return {
    debug: (m, c) => registrar('DEBUG', m, c),
    info: (m, c) => registrar('INFO', m, c),
    warn: (m, c) => registrar('WARN', m, c),
    error: (m, c) => registrar('ERROR', m, c),
  };
}

async function rotacionarLog(arquivo) {
  const info = await stat(arquivo).catch((erro) => {
    if (erro.code === 'ENOENT') return null;
    throw erro;
  });
  if (info && info.size > LIMITE_LOG) await rename(arquivo, `${arquivo}.1`);
}

function dentroDe(raiz, alvo) {
  const rel = path.relative(path.resolve(raiz), path.resolve(alvo));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

async function lerJson(origem, descricao) {
  let texto;
  try {
    if (/^https?:\/\//i.test(origem)) {
      const resposta = await fetch(origem, { signal: AbortSignal.timeout(30_000) });
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      texto = await resposta.text();
    } else {
      texto = await readFile(origem, 'utf8');
    }
  } catch (erro) {
    throw new ErroEntrada(`Não foi possível ler ${descricao} (${origem}): ${erro.message}`);
  }
  try {
    return JSON.parse(texto.startsWith(BOM) ? texto.slice(1) : texto);
  } catch (erro) {
    throw new ErroEntrada(`${descricao} não é um JSON válido (${origem}): ${erro.message}`);
  }
}

export async function executar(opcoes, { raizRepo, saidaErro } = {}) {
  if (raizRepo && dentroDe(raizRepo, opcoes.saida)) {
    throw new ErroEntrada('A pasta de saída precisa ficar fora do repositório.');
  }
  await mkdir(opcoes.saida, { recursive: true });
  const arquivoLog = path.join(opcoes.saida, ARQUIVO_LOG);
  await rotacionarLog(arquivoLog);
  const log = criarLogger(arquivoLog, saidaErro);
  await log.info('Exportação iniciada', { backups: opcoes.backups.length, fuso: opcoes.fuso });
  const sessoes = [];
  const avisos = [];
  for (const arquivo of opcoes.backups) {
    const lido = lerSessoesDoBackup(await lerJson(arquivo, 'o backup'));
    sessoes.push(...lido.sessoes);
    avisos.push(...lido.avisos.map((a) => `${path.basename(arquivo)}: ${a}`));
  }
  const catalogo = lerCatalogoItens(await lerJson(opcoes.itens, 'o catálogo de itens'));
  const modelo = montarModelo(sessoes, catalogo, { fuso: opcoes.fuso });
  for (const aviso of [...avisos, ...modelo.avisos]) await log.warn(aviso);
  const contagem = {};
  for (const [nome, t] of Object.entries(modelo.tabelas)) {
    await writeFile(
      path.join(opcoes.saida, `${nome}.csv`),
      `${BOM}${paraCsv(t.colunas, t.linhas)}`,
    );
    contagem[nome] = t.linhas.length;
  }
  await log.info('Exportação concluída', { sessoes: modelo.sessoes, linhas: contagem });
  return {
    sessoes: modelo.sessoes,
    linhas: contagem,
    avisos: avisos.length + modelo.avisos.length,
  };
}
