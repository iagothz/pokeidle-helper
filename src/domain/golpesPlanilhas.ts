import { COOLDOWN_MEGA_MS, cooldownDoPoder } from './cadencia';
import type { Golpe } from './catalogo';

const BLOCO = /export const (GOLPES_[A-Z0-9_]+) = \{(?!\};)([\s\S]*?)\n\};/g;
const LISTA_TABELAS = /const TABELAS = \[([\s\S]*?)\];/;
const LISTA_FECHADAS = /const TABELAS_FECHADAS = new Set\(\[([\s\S]*?)\]\)/;
const ESPECIE = /(\d+):\s*\[/g;
const LINHA =
  /\[\s*(?:'([^']*)'|"([^"]*)")\s*,\s*'([A-Z]+)'\s*,\s*'([A-Z]+)'\s*,\s*(\d+)\s*(,\s*MEGA\s*)?\]/g;

function golpesDoTrecho(trecho: string): Golpe[] {
  const golpes: Golpe[] = [];
  for (const m of trecho.matchAll(LINHA)) {
    const poder = Number(m[5]);
    const mega = !!m[6];
    golpes.push({
      nome: m[1] ?? m[2] ?? '',
      tipo: m[3] ?? '',
      categoria: m[4] === 'PHYSICAL' ? 'PHYSICAL' : 'SPECIAL',
      poder,
      cooldownMs: mega ? COOLDOWN_MEGA_MS : cooldownDoPoder(poder),
      nivelAprende: 1,
    });
  }
  return golpes;
}

function tabelaDoCorpo(corpo: string): Map<number, Golpe[]> {
  const tabela = new Map<number, Golpe[]>();
  const cabecalhos = [...corpo.matchAll(ESPECIE)];
  cabecalhos.forEach((m, i) => {
    const inicio = (m.index ?? 0) + m[0].length;
    const fim = cabecalhos[i + 1]?.index ?? corpo.length;
    const golpes = golpesDoTrecho(corpo.slice(inicio, fim));
    if (golpes.length) tabela.set(Number(m[1]), golpes);
  });
  return tabela;
}

export interface GolpesDasPlanilhas {
  golpes: Map<number, Golpe[]>;
  fechadas: Set<number>;
}

const nomesDeTabela = (trecho: string | undefined) => trecho?.match(/GOLPES_[A-Z0-9_]+/g) ?? [];

export function lerGolpesDasPlanilhas(texto: string): GolpesDasPlanilhas {
  const golpes = new Map<number, Golpe[]>();
  const fechadas = new Set<number>();
  const ordem = nomesDeTabela(LISTA_TABELAS.exec(texto)?.[1]);
  if (ordem.length === 0) return { golpes, fechadas };
  const tabelasFechadas = new Set(nomesDeTabela(LISTA_FECHADAS.exec(texto)?.[1]));
  const blocos = new Map<string, string>();
  for (const m of texto.matchAll(BLOCO)) if (m[1] && m[2]) blocos.set(m[1], m[2]);
  for (const nome of ordem) {
    const corpo = blocos.get(nome);
    if (!corpo) continue;
    for (const [id, lista] of tabelaDoCorpo(corpo)) {
      golpes.set(id, lista);
      if (tabelasFechadas.has(nome)) fechadas.add(id);
      else fechadas.delete(id);
    }
  }
  return { golpes, fechadas };
}
