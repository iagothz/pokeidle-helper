import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Sessao } from '../domain/sessao';
import type { EntradaLog } from '../shared/logger';

export const NOME_BANCO = 'pokeidle-helper';
export const VERSAO_BANCO = 1;

export interface RegistroLog extends EntradaLog {
  id?: number;
  segmento: number;
}

export interface EsquemaBanco extends DBSchema {
  sessoes: { key: string; value: Sessao; indexes: { porHunt: string; porInicio: number } };
  logs: { key: number; value: RegistroLog; indexes: { porSegmento: number } };
  meta: { key: string; value: unknown };
}

export type Banco = IDBPDatabase<EsquemaBanco>;

type Migracao = (db: IDBPDatabase<EsquemaBanco>) => void;

export const MIGRACOES: Record<number, Migracao> = {
  1: (db) => {
    const sessoes = db.createObjectStore('sessoes', { keyPath: 'id' });
    sessoes.createIndex('porHunt', 'huntSlug');
    sessoes.createIndex('porInicio', 'inicio');
    const logs = db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
    logs.createIndex('porSegmento', 'segmento');
    db.createObjectStore('meta');
  },
};

export function abrirBanco(nome = NOME_BANCO): Promise<Banco> {
  return openDB<EsquemaBanco>(nome, VERSAO_BANCO, {
    upgrade(db, versaoAntiga) {
      for (let v = versaoAntiga + 1; v <= VERSAO_BANCO; v++) MIGRACOES[v]?.(db);
    },
  });
}
