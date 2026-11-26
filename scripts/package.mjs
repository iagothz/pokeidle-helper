import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { zipSync } from 'fflate';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(raiz, 'dist');
const pkg = JSON.parse(await readFile(path.join(raiz, 'package.json'), 'utf8'));

const arquivos = {};
for (const nome of await readdir(dist)) {
  arquivos[nome] = new Uint8Array(await readFile(path.join(dist, nome)));
}

await mkdir(path.join(raiz, 'release'), { recursive: true });
const destino = path.join(raiz, 'release', `pokeidle-helper-v${pkg.version}.zip`);
await writeFile(destino, zipSync(arquivos, { level: 9 }));
console.log(`Pacote gerado: ${path.relative(raiz, destino)}`);
