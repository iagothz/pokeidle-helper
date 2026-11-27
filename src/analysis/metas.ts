import { horasParaGanhar, type RitmoXp } from './progressao';

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

function msParaGanhar(faltam: number, ritmo: number | RitmoXp): number | null {
  if (typeof ritmo === 'number') return ritmo > 0 ? (faltam / ritmo) * MS_HORA : null;
  const horas = horasParaGanhar(faltam, ritmo.xpHBase, ritmo.faixas, ritmo.quem);
  return Number.isFinite(horas) ? horas * MS_HORA : null;
}

export function previsaoDeNivel(
  p: ProgressoXp | undefined,
  ritmo: number | RitmoXp,
): PrevisaoNivel | null {
  if (!p || p.xp === undefined || p.xpProximo === undefined) return null;
  const faltam = Math.max(0, p.xpProximo - p.xp);
  const faixa = p.xpNivel !== undefined ? p.xpProximo - p.xpNivel : 0;
  const progresso =
    faixa > 0 && p.xpNivel !== undefined ? Math.min(1, Math.max(0, (p.xp - p.xpNivel) / faixa)) : 0;
  return {
    nivelAlvo: p.level !== undefined ? p.level + 1 : null,
    faltam,
    progresso,
    msAte: msParaGanhar(faltam, ritmo),
  };
}
