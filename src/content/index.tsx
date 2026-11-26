import { escutarPonte } from '../bridge/receptor';
import { CatalogoEspecies, CatalogoItens } from '../domain/catalogo';
import { EstadoJogo } from '../domain/estadoJogo';
import { lerVersaoJogo } from '../domain/versaoJogo';
import { abrirBanco } from '../persistence/banco';
import { DestinoLogBanco } from '../persistence/destinoLogBanco';
import { RepositorioSessoes } from '../persistence/repositorioSessoes';
import { CHAVE_CONFIG, mesclarConfig, type OverridesConfig } from '../shared/config';
import { DestinoConsole, GerenciadorLog, erroParaCtx, type NivelLog } from '../shared/logger';
import { baixarJson, montarInterface } from '../ui/montar';
import { Aplicacao } from './aplicacao';
import type { EnvelopeValido } from '../bridge/receptor';
import type { Sessao } from '../domain/sessao';

const versao = __VERSAO__;
const gerenciador = new GerenciadorLog('INFO');
gerenciador.adicionarDestino(new DestinoConsole());
const log = gerenciador.logger('helper');

const pendentes: EnvelopeValido[] = [];
let entregar: (e: EnvelopeValido) => void = (e) => {
  if (pendentes.length < 5000) pendentes.push(e);
};
const pararPonte = escutarPonte(
  window,
  window.location.origin,
  (e) => entregar(e),
  log.filho('ponte'),
);

async function lerOverrides(): Promise<unknown> {
  try {
    const r = await chrome.storage.local.get(CHAVE_CONFIG);
    return r[CHAVE_CONFIG];
  } catch (erro) {
    log.warn('Não foi possível ler a configuração salva', erroParaCtx(erro));
    return undefined;
  }
}

async function salvarOverride(parcial: OverridesConfig): Promise<void> {
  const atual = ((await lerOverrides()) ?? {}) as OverridesConfig;
  await chrome.storage.local.set({ [CHAVE_CONFIG]: { ...atual, ...parcial } });
}

async function carregarCatalogos(origem: string, caminhosEspecies: string[], caminhoItens: string) {
  const especies = new CatalogoEspecies();
  const itens = new CatalogoItens();
  const baixar = async (caminho: string) => {
    const r = await fetch(new URL(caminho, origem), { credentials: 'same-origin' });
    if (!r.ok) throw new Error(`HTTP ${r.status} em ${caminho}`);
    return r.json() as Promise<unknown>;
  };
  const resultados = await Promise.allSettled([
    ...caminhosEspecies.map(baixar),
    baixar(caminhoItens),
  ]);
  resultados.forEach((r, i) => {
    const caminho = i < caminhosEspecies.length ? caminhosEspecies[i] : caminhoItens;
    if (r.status === 'rejected') {
      log.warn('Catálogo indisponível', { caminho, ...erroParaCtx(r.reason) });
      return;
    }
    if (i < caminhosEspecies.length) especies.adicionarJson(r.value);
    else itens.adicionarJson(r.value);
  });
  log.info('Catálogos carregados', { especies: especies.tamanho });
  return { especies, itens };
}

function quandoPronto(fn: () => void) {
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  else fn();
}

async function iniciar() {
  const { config, avisos } = mesclarConfig(await lerOverrides());
  let nivelAtual: NivelLog = config.logLevel;
  gerenciador.definirNivel(nivelAtual);
  avisos.forEach((a) => log.warn(a));

  let destinoBanco: DestinoLogBanco | null = null;
  let repositorio: RepositorioSessoes | null = null;
  try {
    const banco = await abrirBanco();
    destinoBanco = new DestinoLogBanco(banco, config.logs);
    gerenciador.adicionarDestino(destinoBanco);
    repositorio = new RepositorioSessoes(banco);
    const fechadas = await repositorio.fecharAbertas();
    if (fechadas) log.info('Sessões da visita anterior fechadas', { fechadas });
  } catch (erro) {
    log.error('IndexedDB indisponível; o histórico não será salvo nesta visita', erroParaCtx(erro));
  }

  const { especies, itens } = await carregarCatalogos(
    config.jogo.origem,
    config.jogo.assetsEspecies,
    config.jogo.assetItens,
  );
  const estado = new EstadoJogo(log.filho('estado'));
  const memoria = new Map<string, Sessao>();
  const app = new Aplicacao({
    config,
    log: log.filho('app'),
    estado,
    repositorio: repositorio ?? {
      salvar: async (s) => memoria.set(s.id, s),
      listar: async () => [...memoria.values()],
      limpar: async () => memoria.clear(),
    },
    especies,
    itens,
    versao,
  });
  if (!repositorio)
    app.avisar('O navegador bloqueou o armazenamento local; o histórico só vale até fechar a aba.');
  await app.carregarHistorico();

  entregar = (e) => app.receber(e);
  for (const e of pendentes.splice(0)) app.receber(e);

  const checkpoint = window.setInterval(() => app.checkpoint(), 30_000);
  const descarga = window.setInterval(() => void destinoBanco?.descarregar(), config.logs.flushMs);
  window.addEventListener('pagehide', () => {
    app.checkpoint();
    void destinoBanco?.descarregar();
  });

  quandoPronto(() => {
    app.definirVersaoJogo(lerVersaoJogo(document));
    const ui = montarInterface(document, app, {
      exportarDados: () =>
        baixarJson(
          document,
          ui.raiz,
          `pokeidle-helper-dados-${Date.now()}.json`,
          app.exportarDados(),
        ),
      exportarLogs: () => {
        void (async () => {
          const logs = destinoBanco ? await destinoBanco.exportar() : [];
          baixarJson(document, ui.raiz, `pokeidle-helper-logs-${Date.now()}.json`, {
            versao,
            logs,
          });
        })();
      },
      limparHistorico: () => app.limparHistorico(),
      definirNivelLog: (nivel: NivelLog) => {
        nivelAtual = nivel;
        gerenciador.definirNivel(nivel);
        void salvarOverride({ logLevel: nivel }).catch((erro: unknown) =>
          log.warn('Falha ao salvar nível de log', erroParaCtx(erro)),
        );
      },
      nivelLog: () => nivelAtual,
    });
    log.info('Helper iniciado', { versao });
  });

  return () => {
    pararPonte();
    clearInterval(checkpoint);
    clearInterval(descarga);
  };
}

iniciar().catch((erro: unknown) => log.error('Falha ao iniciar o helper', erroParaCtx(erro)));
