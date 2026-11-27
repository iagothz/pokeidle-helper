export type Celula = string | number | boolean | null | undefined;

export function paraCsv(colunas: readonly string[], linhas: readonly (readonly Celula[])[]): string;
