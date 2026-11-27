export const ITENS_PADRAO: string;

export interface OpcoesExportacao {
  backups: string[];
  saida: string;
  itens: string;
  fuso: string;
}

export function interpretarArgumentos(argv: readonly string[]): OpcoesExportacao;
export function executar(
  opcoes: OpcoesExportacao,
  ambiente?: { raizRepo?: string; saidaErro?: { write(texto: string): unknown } },
): Promise<{ sessoes: number; linhas: Record<string, number>; avisos: number }>;
export const BOM: string;
