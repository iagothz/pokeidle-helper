import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { executar, interpretarArgumentos } from './powerbi/cli.mjs';
import { ErroEntrada } from './powerbi/modelo.mjs';

const raizRepo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const USO =
  'Uso: node scripts/exportar-powerbi.mjs <backup.json> [mais partes...] --saida <pasta> [--itens <arquivo|url>] [--fuso <IANA>]';

try {
  const r = await executar(interpretarArgumentos(process.argv.slice(2)), { raizRepo });
  process.stdout.write(
    `${r.sessoes} sessões exportadas. Linhas: ${JSON.stringify(r.linhas)}. Avisos: ${r.avisos}.\n`,
  );
} catch (erro) {
  if (erro instanceof ErroEntrada) {
    process.stderr.write(`Erro: ${erro.message}\n${USO}\n`);
    process.exitCode = 2;
  } else {
    process.stderr.write(`Falha inesperada na exportação:\n${erro?.stack ?? erro}\n`);
    process.exitCode = 1;
  }
}
