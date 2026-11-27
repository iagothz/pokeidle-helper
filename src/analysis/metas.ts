const MS_HORA = 3_600_000;

export interface ProgressoXp {
  level?: number | undefined;
  xp?: number | undefined;
  xpNivel?: number | undefined;
  xpProximo?: number | undefined;
}

export interface PrevisaoNivel {
  nivelAlvo: number | null;
  faltam: number;
  progresso: number;
  msAte: number | null;
}

export function previsaoDeNivel(p: ProgressoXp | undefined, porHora: number): PrevisaoNivel | null {
  if (!p || p.xp === undefined || p.xpProximo === undefined) return null;
  const faltam = Math.max(0, p.xpProximo - p.xp);
  const faixa = p.xpNivel !== undefined ? p.xpProximo - p.xpNivel : 0;
  const progresso =
    faixa > 0 && p.xpNivel !== undefined ? Math.min(1, Math.max(0, (p.xp - p.xpNivel) / faixa)) : 0;
  return {
    nivelAlvo: p.level !== undefined ? p.level + 1 : null,
    faltam,
    progresso,
    msAte: porHora > 0 ? (faltam / porHora) * MS_HORA : null,
  };
}
