import { chromium } from 'playwright-core';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dist = path.join(raiz, 'dist');
const fixture = async (nome) => readFile(path.join(raiz, 'tests/fixtures', nome), 'utf8');
const executavel = process.env.CHROME_PATH || chromium.executablePath();
const versaoValidada = /VERSAO_JOGO_VALIDADA = '([^']+)'/.exec(
  await readFile(path.join(raiz, 'src/shared/protocolo.ts'), 'utf8'),
)[1];

const paginaJogo = `<!doctype html><html><head><meta charset="utf-8"><title>Pokeidle</title>
<script src="app.js?v=${versaoValidada}"></script></head><body>
<div id="jogo">jogo falso</div>
<script>
  window.__recebidosPeloJogo = 0;
  window.__enviadosPelaPagina = 0;
  const enviarOriginal = WebSocket.prototype.send;
  WebSocket.prototype.send = function (d) { window.__enviadosPelaPagina++; return enviarOriginal.call(this, d); };
  const ws = new WebSocket('wss://pokeidle.io');
  ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', nick: 'teste' }));
  ws.onmessage = () => { window.__recebidosPeloJogo++; };
</script></body></html>`;

async function principal() {
  const perfil = await mkdtemp(path.join(tmpdir(), 'pokeidle-helper-e2e-'));
  const contexto = await chromium.launchPersistentContext(perfil, {
    executablePath: executavel,
    headless: false,
    args: [
      '--headless=new',
      `--disable-extensions-except=${dist}`,
      `--load-extension=${dist}`,
      '--disable-features=DisableLoadExtensionCommandLineSwitch',
      '--no-sandbox',
    ],
  });
  const recebidosPeloServidor = [];
  let enviadosPeloServidor = 0;
  try {
    const welcome = await fixture('welcome.json');
    const batalhas = JSON.parse(await fixture('batalha-bellsprout.json'));
    await contexto.route('https://pokeidle.io/**', async (rota) => {
      const url = new URL(rota.request().url());
      if (url.pathname === '/app')
        return rota.fulfill({ contentType: 'text/html', body: paginaJogo });
      if (url.pathname === '/app.js')
        return rota.fulfill({ contentType: 'text/javascript', body: '' });
      if (url.pathname === '/assets/creatures.json')
        return rota.fulfill({
          contentType: 'application/json',
          body: await fixture('creatures.json'),
        });
      if (url.pathname === '/assets/items.json')
        return rota.fulfill({ contentType: 'application/json', body: await fixture('items.json') });
      return rota.fulfill({ status: 404, body: '' });
    });
    await contexto.routeWebSocket(/pokeidle\.io/, (ws) => {
      ws.onMessage((m) => {
        recebidosPeloServidor.push(String(m));
        const enviar = (obj) => {
          ws.send(typeof obj === 'string' ? obj : JSON.stringify(obj));
          enviadosPeloServidor++;
        };
        enviar(welcome);
        for (const b of batalhas) {
          enviar({ t: 'batalha', ev: b.ev });
          enviar({ t: 'campo', mobs: [] });
        }
        enviar({ t: 'estado', estado: { gold: 9999 } });
      });
    });

    const pagina = await contexto.newPage();
    const errosPagina = [];
    pagina.on('pageerror', (e) => errosPagina.push(e.message));
    await pagina.goto('https://pokeidle.io/app');

    const botao = pagina.locator('#pokeidle-helper-raiz').locator('button.botao-flutuante');
    await botao.waitFor({ timeout: 15000 });
    await pagina.waitForFunction((n) => window.__recebidosPeloJogo >= n, 1, { timeout: 10000 });
    await pagina.waitForTimeout(1500);
    await botao.click();
    const painel = pagina.locator('#pokeidle-helper-raiz section.painel');
    await painel.waitFor();
    await pagina.waitForTimeout(1500);

    const textoSessao = await painel.innerText();
    assert.match(textoSessao, /Bellsprout/, 'a aba Sessão deve mostrar a hunt atual');
    assert.match(textoSessao, /3 abates/, 'a sessão deve contar os 3 abates da fixture');
    assert.match(textoSessao, /Potion/, 'a sessão deve listar o consumível usado');

    await painel.getByRole('tab', { name: 'Hunts' }).click();
    const textoHunts = await painel.innerText();
    assert.match(textoHunts, /Geodude/, 'o ranking deve listar as hunts do welcome');

    await painel.getByRole('tab', { name: 'Opções' }).click();
    const textoOpcoes = await painel.innerText();
    assert.match(textoOpcoes, /Login capturado\s*sim/, 'o diagnóstico deve confirmar o welcome');
    assert.match(
      textoOpcoes,
      /Espécies no catálogo\s*5/,
      'o catálogo de espécies deve carregar dos assets',
    );
    assert.match(
      textoOpcoes,
      new RegExp(`Versão do jogo\\s*${versaoValidada.replaceAll('.', '\\.')}`),
      'o diagnóstico deve mostrar a versão lida do app.js',
    );
    assert.doesNotMatch(textoOpcoes, /O jogo foi atualizado/, 'versão validada não gera aviso');
    await painel.getByRole('tab', { name: 'Sessão' }).click();
    assert.match(
      await painel.innerText(),
      /vantagem/,
      'a dica de tipo depende do catálogo e da tabela do servidor',
    );

    const enviadosPelaPagina = await pagina.evaluate(() => window.__enviadosPelaPagina);
    const recebidosPeloJogo = await pagina.evaluate(() => window.__recebidosPeloJogo);
    assert.equal(recebidosPeloServidor.length, 1, 'o servidor deve receber só o hello do jogo');
    assert.equal(enviadosPelaPagina, 1, 'nenhum envio além do hello do jogo');
    assert.equal(
      recebidosPeloJogo,
      enviadosPeloServidor,
      'o jogo deve receber todas as mensagens intactas',
    );
    assert.deepEqual(errosPagina, [], 'a página não pode ter erros');
    assert.equal(
      await pagina.locator('#jogo').innerText(),
      'jogo falso',
      'o DOM do jogo não pode mudar',
    );

    const resumo = `servidor recebeu ${recebidosPeloServidor.length} mensagem · jogo recebeu ${recebidosPeloJogo}/${enviadosPeloServidor}`;

    await painel.getByRole('tab', { name: 'Histórico' }).click();
    assert.match(
      await painel.innerText(),
      /Nenhuma sessão salva ainda|sessão/,
      'a aba Histórico deve abrir',
    );
    await painel.getByRole('button', { name: 'Minimizar' }).click();
    assert.equal(await painel.locator('.conteudo').count(), 0, 'minimizar esconde o conteúdo');
    await pagina.waitForTimeout(300);
    await pagina.reload();
    await botao.waitFor({ timeout: 15000 });
    await botao.click();
    await painel.waitFor();
    assert.equal(
      await painel.locator('.conteudo').count(),
      0,
      'o painel deve continuar minimizado depois de recarregar (chrome.storage)',
    );
    await painel.getByRole('button', { name: 'Restaurar' }).click();
    assert.match(await painel.innerText(), /Histórico/, 'restaura na última aba usada');

    console.log(`E2E OK · ${resumo}`);
  } finally {
    await contexto.close();
    await rm(perfil, { recursive: true, force: true });
  }
}

principal().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
