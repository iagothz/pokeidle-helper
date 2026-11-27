import type { Celula } from './csv.mjs';

export const FORMATO_BACKUP: 'pokeidle-helper-backup';
export const PRECOS_BOLAS: readonly { id: number; nome: string; preco: number }[];

export class ErroEntrada extends Error {}

export interface ItemCatalogo {
  id: number;
  nome: string;
  categoria: string | null;
  precoNpc: number;
  precoCompra: number;
  raro: boolean;
}

export interface SessaoLida {
  id: string;
  huntSlug: string;
  huntNome: string;
  inicio: number;
  fim: number;
  trechos: Record<string, unknown>[];
  abatesDetalhe: Record<string, unknown>[];
  consumo: Record<string, unknown>[];
  [campo: string]: unknown;
}

export interface Tabela {
  colunas: string[];
  linhas: Celula[][];
}

export function lerSessoesDoBackup(json: unknown): { sessoes: SessaoLida[]; avisos: string[] };
export function lerCatalogoItens(json: unknown): Map<number, ItemCatalogo>;
export function montarModelo(
  sessoes: readonly SessaoLida[],
  catalogo: ReadonlyMap<number, ItemCatalogo>,
  opcoes: { fuso: string },
): { tabelas: Record<string, Tabela>; avisos: string[]; sessoes: number };
