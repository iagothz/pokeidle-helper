const compacto = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const inteiro = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

export function numero(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return Math.abs(v) >= 100_000 ? compacto.format(v) : inteiro.format(v);
}

export function fracao(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return decimal.format(v);
}

export function duracao(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86_400);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const dois = (n: number) => String(n).padStart(2, '0');
  if (d > 0) return `${d}d ${dois(h % 24)}h`;
  if (h > 0) return `${h}h ${dois(m)}min`;
  if (m >= 10) return `${m}min`;
  if (m > 0) return `${m}min ${dois(s % 60)}s`;
  return `${s}s`;
}

const LIMITE_CURTO = 10_000;

export function curto(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return Math.abs(v) >= LIMITE_CURTO ? compacto.format(v) : inteiro.format(v);
}

export function comSinal(v: number): string {
  const texto = curto(v);
  return v > 0 && Math.round(v) !== 0 ? `+${texto}` : texto;
}
