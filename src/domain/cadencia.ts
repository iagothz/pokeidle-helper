export const PODER_MINIMO = 15;
const PODER_JOELHO = 100;
export const COOLDOWN_600_MS = 60_000;
export const COOLDOWN_MEGA_MS = 30_000;
const SPEED_JOELHO = 120;
const SPEED_TETO_PCT = 7;
const INTERVALO_GLOBAL_MS = 900;
const INVESTIDA_MS = 2000;
const INTERVALO_MINIMO_MS = 400;
const REDUCAO_POR_IV_SPEED_MS = 10;

export function cooldownDoPoder(poder: number): number {
  const p = Number.isFinite(poder) && poder > PODER_MINIMO ? poder : PODER_MINIMO;
  const seg =
    p <= PODER_JOELHO
      ? 10 + ((p - PODER_MINIMO) * 20) / (PODER_JOELHO - PODER_MINIMO)
      : 30 + ((p - PODER_JOELHO) * 30) / (600 - PODER_JOELHO);
  return Math.round(seg * 10) * 100;
}

const ivSpeed = (iv: number | undefined) => Math.min(32, Math.max(1, Math.round(Number(iv) || 1)));

export function descontoDoSpeedPct(speedBase: number, iv: number | undefined): number {
  const s = Math.max(0, Number(speedBase) || 0);
  const potencial = Math.min(
    SPEED_TETO_PCT,
    s <= SPEED_JOELHO ? s / 20 : 6 + (s - SPEED_JOELHO) / 40,
  );
  return potencial * (ivSpeed(iv) / 32);
}

export function cooldownComSpeed(
  cooldownMs: number,
  speedBase: number,
  iv: number | undefined,
): number {
  const base = Math.max(0, Number(cooldownMs) || 0);
  if (base <= 0) return base;
  return Math.round(base * (1 - descontoDoSpeedPct(speedBase, iv) / 100));
}

export function intervaloGlobalMs(iv: number | undefined): number {
  return Math.max(INTERVALO_MINIMO_MS, INTERVALO_GLOBAL_MS - REDUCAO_POR_IV_SPEED_MS * ivSpeed(iv));
}

export function recargaInvestidaMs(iv: number | undefined): number {
  return Math.max(INTERVALO_MINIMO_MS, INVESTIDA_MS - REDUCAO_POR_IV_SPEED_MS * ivSpeed(iv));
}
