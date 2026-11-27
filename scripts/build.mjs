import { build, context } from 'esbuild';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const saida = path.join(raiz, 'dist');
const pkg = JSON.parse(await readFile(path.join(raiz, 'package.json'), 'utf8'));
const observar = process.argv.includes('--watch');

const comum = {
  bundle: true,
  format: 'iife',
  target: ['chrome111'],
  jsx: 'automatic',
  jsxImportSource: 'preact',
  legalComments: 'none',
  minify: !observar,
  sourcemap: observar ? 'inline' : false,
  define: { __VERSAO__: JSON.stringify(pkg.version) },
  logLevel: 'info',
};

const alvos = [
  {
    ...comum,
    entryPoints: [path.join(raiz, 'src/capture/index.ts')],
    outfile: path.join(saida, 'capture.js'),
  },
  {
    ...comum,
    entryPoints: [path.join(raiz, 'src/content/index.tsx')],
    outfile: path.join(saida, 'content.js'),
  },
  {
    ...comum,
    entryPoints: [path.join(raiz, 'src/background/index.ts')],
    outfile: path.join(saida, 'background.js'),
  },
];

async function gerarManifesto() {
  const manifesto = JSON.parse(await readFile(path.join(raiz, 'src/manifest.json'), 'utf8'));
  manifesto.version = pkg.version;
  await writeFile(path.join(saida, 'manifest.json'), JSON.stringify(manifesto, null, 2) + '\n');
}

await rm(saida, { recursive: true, force: true });
await mkdir(saida, { recursive: true });
await gerarManifesto();

if (observar) {
  for (const alvo of alvos) {
    const ctx = await context(alvo);
    await ctx.watch();
  }
} else {
  await Promise.all(alvos.map((alvo) => build(alvo)));
}
