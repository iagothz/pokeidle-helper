import { chromium } from 'playwright-core';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(raiz, 'dist');
const saida = process.argv[2];
const prefixo = process.argv[3] ?? 'painel';
const fixture = async (nome) => readFile(path.join(raiz, 'tests/fixtures', nome), 'utf8');
const executavel = process.env.CHROME_PATH;
const pagina = `<!doctype html><html><head><meta charset="utf-8"><title>Pokeidle</title>
<script src="app.js?v=1.492.0"></script></head><body style="margin:0;background:#3a5a2a;height:100vh">
<script>const ws = new WebSocket('wss://pokeidle.io'); ws.onopen = () => ws.send('{"t":"hello"}');</script></body></html>`;

const perfil = await mkdtemp(path.join(tmpdir(), 'pokeidle-prints-'));
const ctx = await chromium.launchPersistentContext(perfil, {
  executablePath: executavel,
  headless: false,
  viewport: { width: 520, height: 900 },
  args: [
    '--headless=new',
    `--disable-extensions-except=${dist}`,
    `--load-extension=${dist}`,
    '--no-sandbox',
  ],
});
try {
  const welcome = JSON.parse(await fixture('welcome.json'));
  welcome.estado = {
    ...welcome.estado,
    level: 12,
    xp: 30000,
    xpNivel: 26950,
    xpProximo: 36400,
    items: { 11: 40, 12: 3 },
    balls: { 1: 80, 2: 10 },
    pokemons: [
      {
        ...welcome.estado.pokemons[0],
        level: 14,
        xp: 30000,
        xpNivel: 26950,
        xpProximo: 36400,
        refino: { atk: 3 },
      },
      { ...welcome.estado.pokemons[1], level: 20 },
    ],
  };
  const batalhas = JSON.parse(await fixture('batalha-bellsprout.json'));
  await ctx.route('https://pokeidle.io/**', async (r) => {
    const u = new URL(r.request().url());
    if (u.pathname === '/app') return r.fulfill({ contentType: 'text/html', body: pagina });
    if (u.pathname === '/app.js') return r.fulfill({ contentType: 'text/javascript', body: '' });
    if (u.pathname === '/assets/creatures.json')
      return r.fulfill({ contentType: 'application/json', body: await fixture('creatures.json') });
    if (u.pathname === '/assets/items.json')
      return r.fulfill({ contentType: 'application/json', body: await fixture('items.json') });
    return r.fulfill({ status: 404, body: '' });
  });
  await ctx.routeWebSocket(/pokeidle\.io/, (ws) => {
    ws.onMessage(() => {
      ws.send(JSON.stringify(welcome));
      let t = 0;
      for (let i = 0; i < 8; i++)
        for (const b of batalhas) ws.send(JSON.stringify({ t: 'batalha', ev: b.ev }));
      const golpes = Array.from({ length: 24 }, (_, i) => ({
        k: 'ataque',
        por: 'selvagem',
        tipo: 'GRASS',
        dano: 40,
        ef: i % 3 === 0 ? 2 : 1,
      }));
      ws.send(
        JSON.stringify({
          t: 'batalha',
          ev: [
            ...golpes,
            { k: 'cura', itemId: 11 },
            { k: 'cura', itemId: 11 },
            { k: 'cura', itemId: 11 },
          ],
        }),
      );
      void t;
    });
  });
  const p = await ctx.newPage();
  await p.goto('https://pokeidle.io/app');
  const botao = p.locator('#pokeidle-helper-raiz').locator('button.botao-flutuante');
  await botao.waitFor({ timeout: 15000 });
  await p.waitForTimeout(1500);
  await botao.click();
  const painel = p.locator('#pokeidle-helper-raiz section.painel');
  await painel.waitFor();
  await p.waitForTimeout(1200);
  for (const aba of ['Sessão', 'Time', 'Progresso', 'Economia', 'Hunts', 'Histórico', 'Opções']) {
    await painel.getByRole('tab', { name: aba }).click();
    await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(saida, `${prefixo}-${aba}.png`) });
  }
  console.log('prints ok');
} finally {
  await ctx.close();
  await rm(perfil, { recursive: true, force: true });
}
