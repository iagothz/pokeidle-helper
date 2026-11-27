export type Nota = number;
export type Categoria = 'bom' | 'neutro' | 'ruim' | 'apagado';

const UM_TERCO = 1 / 3;
const DOIS_TERCOS = 2 / 3;
const EPS = 1e-9;

const VERMELHO = [255, 93, 93] as const;
const BRANCO = [241, 244, 248] as const;
const VERDE = [52, 210, 123] as const;

const AUTONOMIA_RUIM_MS = 15 * 60_000;
const AUTONOMIA_PASSO = 4;
const SUPER_EFETIVO_ZERO = 0.45;
const GOLPES_BONS = 3;
const GOLPES_PASSO = 5;
const RESISTENCIA_PASSO = 5;
const FAIXA_RELATIVA = 0.1;
const PERTO_DO_MELHOR = 0.9;
const LONGE_DO_MELHOR = 0.5;

const limitar = (n: number) => Math.min(1, Math.max(0, n));
const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);

export function corDaNota(nota: Nota | null): string | null {
  if (nota === null || !Number.isFinite(nota)) return null;
  const n = limitar(nota);
  const [de, para, t] = n < 0.5 ? [VERMELHO, BRANCO, n / 0.5] : [BRANCO, VERDE, (n - 0.5) / 0.5];
  return `rgb(${lerp(de[0], para[0], t)}, ${lerp(de[1], para[1], t)}, ${lerp(de[2], para[2], t)})`;
}

export function categoria(nota: Nota | null): Categoria {
  if (nota === null || !Number.isFinite(nota)) return 'apagado';
  if (nota >= DOIS_TERCOS - EPS) return 'bom';
  if (nota < UM_TERCO - EPS) return 'ruim';
  return 'neutro';
}

export function notaSinal(v: number | null | undefined): Nota | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  if (Math.abs(v) < 0.5) return 0.5;
  return v > 0 ? 1 : 0;
}

export function notaRelativa(v: number, referencia: number | null | undefined): Nota {
  if (!referencia || referencia <= 0 || !Number.isFinite(v)) return 0.5;
  return limitar(0.5 + ((v / referencia - 1) * (DOIS_TERCOS - 0.5)) / FAIXA_RELATIVA);
}

const escalaLog = (razao: number, passo: number) =>
  Math.log(Math.max(razao, 1e-12)) / Math.log(passo);

export function notaAutonomia(ms: number | null | undefined): Nota | null {
  if (ms === null || ms === undefined) return null;
  return limitar(UM_TERCO + UM_TERCO * escalaLog(ms / AUTONOMIA_RUIM_MS, AUTONOMIA_PASSO));
}

export function notaSuperEfetivos(fracao: number): Nota {
  return limitar(1 - fracao / SUPER_EFETIVO_ZERO);
}

export function notaContagem(n: number): Nota {
  return n <= 0 ? 1 : limitar(0.3 - 0.1 * (n - 1));
}

export function notaGolpes(golpes: number): Nota {
  return limitar(DOIS_TERCOS - UM_TERCO * escalaLog(golpes / GOLPES_BONS, GOLPES_PASSO));
}

export function notaResistencia(segundosParaDesmaiar: number | null, tAbateS: number): Nota | null {
  if (segundosParaDesmaiar === null || !(tAbateS > 0)) return null;
  return limitar(
    UM_TERCO + UM_TERCO * escalaLog(segundosParaDesmaiar / tAbateS, RESISTENCIA_PASSO),
  );
}

export function notaPercentil(v: number, todos: readonly number[]): Nota {
  const validos = todos.filter(Number.isFinite);
  const abaixo = validos.filter((x) => x < v).length;
  const iguais = validos.filter((x) => x === v).length;
  if (iguais > 0) {
    const outros = validos.length - 1;
    return outros > 0 ? (abaixo + (iguais - 1) / 2) / outros : 0.5;
  }
  return validos.length > 0 ? abaixo / validos.length : 0.5;
}

export function notaVsMelhor(v: number, melhor: number): Nota {
  if (!(melhor > 0)) return 0.5;
  const r = v / melhor;
  if (r >= PERTO_DO_MELHOR)
    return limitar(DOIS_TERCOS + ((r - PERTO_DO_MELHOR) / (1 - PERTO_DO_MELHOR)) * UM_TERCO);
  return limitar(
    UM_TERCO + ((r - LONGE_DO_MELHOR) / (PERTO_DO_MELHOR - LONGE_DO_MELHOR)) * UM_TERCO,
  );
}

export interface EstadoGeral {
  lucroRealH: number;
  autonomiaMs: number | null;
  desmaios: number;
  perigo: boolean;
}

export function notaGeral(e: EstadoGeral | null): Nota {
  if (!e) return 0.5;
  if (e.lucroRealH < 0 || e.desmaios > 0 || e.perigo) return 0;
  if (e.autonomiaMs !== null && e.autonomiaMs < AUTONOMIA_RUIM_MS) return 0;
  return e.lucroRealH > 0 ? 1 : 0.5;
}

export interface NotaDinamica {
  nota: Nota;
  percentil: number | null;
  vsHistorico: number | null;
}

export function notaDinamica(
  valor: number,
  outras: readonly number[],
  historico: number | null,
): NotaDinamica {
  const validas = outras.filter(Number.isFinite);
  const percentil =
    validas.length > 0
      ? (validas.filter((v) => v < valor).length + validas.filter((v) => v === valor).length / 2) /
        validas.length
      : null;
  const vsHistorico =
    historico !== null && historico > 0 && Number.isFinite(valor) ? valor / historico - 1 : null;
  if (valor < 0) return { nota: 0, percentil, vsHistorico };
  const deslocamento =
    vsHistorico === null
      ? 0
      : Math.min(UM_TERCO, Math.max(-UM_TERCO, (vsHistorico / FAIXA_RELATIVA) * UM_TERCO));
  return { nota: limitar((percentil ?? 0.5) + deslocamento), percentil, vsHistorico };
}
