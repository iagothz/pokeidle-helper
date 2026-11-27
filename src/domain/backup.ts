import * as z from 'zod';
import { normalizarSessao, type Sessao } from './sessao';

export const FORMATO_BACKUP = 'pokeidle-helper-backup';

export interface Backup {
  formato: typeof FORMATO_BACKUP;
  versao: string;
  geradoEm: number;
  sessoes: Sessao[];
}

const naoNegativo = z.coerce.number().finite().min(0);
const contador = naoNegativo.catch(0);
const mapa = z.record(z.string(), z.number()).catch({});

const esquemaSessao = z
  .object({
    id: z.string().min(1),
    huntSlug: z.string().min(1),
    huntNome: z.string().catch(''),
    inicio: naoNegativo,
    fim: naoNegativo,
    msAtivo: naoNegativo,
    xpTreinador: contador,
    xpPokemon: contador,
    gold: contador,
    abates: contador,
    capturas: contador,
    shiniesVistos: contador,
    shinies: contador,
    bolas: mapa,
    pocoes: mapa,
    revives: mapa,
    spawns: mapa,
    drops: z
      .record(z.string(), z.object({ nome: z.string().optional(), qtd: z.number() }))
      .catch({}),
  })
  .passthrough();

export function montarBackup(sessoes: readonly Sessao[], versao: string, agora: number): Backup {
  return { formato: FORMATO_BACKUP, versao, geradoEm: agora, sessoes: [...sessoes] };
}

export interface LeituraBackup {
  sessoes: Sessao[];
  invalidas: number;
  formatoValido: boolean;
}

function listaDe(json: unknown): unknown[] | null {
  if (Array.isArray(json)) return json;
  if (json && typeof json === 'object') {
    const sessoes = (json as { sessoes?: unknown }).sessoes;
    if (Array.isArray(sessoes)) return sessoes;
  }
  return null;
}

export function lerBackup(json: unknown): LeituraBackup {
  const lista = listaDe(json);
  if (!lista) return { sessoes: [], invalidas: 0, formatoValido: false };
  const sessoes: Sessao[] = [];
  let invalidas = 0;
  for (const bruta of lista) {
    const res = esquemaSessao.safeParse(bruta);
    if (!res.success) {
      invalidas++;
      continue;
    }
    sessoes.push(normalizarSessao({ ...(res.data as unknown as Sessao), aberta: false }));
  }
  return { sessoes, invalidas, formatoValido: true };
}

export function mesclarSessoes(
  atuais: Map<string, Sessao>,
  importadas: readonly Sessao[],
): { novas: number; atualizadas: number; mantidas: number } {
  const r = { novas: 0, atualizadas: 0, mantidas: 0 };
  for (const s of importadas) {
    const atual = atuais.get(s.id);
    if (!atual) {
      atuais.set(s.id, s);
      r.novas++;
    } else if (s.msAtivo > atual.msAtivo) {
      atuais.set(s.id, s);
      r.atualizadas++;
    } else {
      r.mantidas++;
    }
  }
  return r;
}

export function particionarSessoes(sessoes: readonly Sessao[], maxBytes: number): Sessao[][] {
  const partes: Sessao[][] = [];
  let atual: Sessao[] = [];
  let bytes = 0;
  for (const s of sessoes) {
    const tamanho = JSON.stringify(s).length + 1;
    if (atual.length > 0 && bytes + tamanho > maxBytes) {
      partes.push(atual);
      atual = [];
      bytes = 0;
    }
    atual.push(s);
    bytes += tamanho;
  }
  partes.push(atual);
  return partes;
}
