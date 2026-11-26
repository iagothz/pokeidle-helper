import type { Hunt } from '../domain/schemas';

export const VERSAO_FORMULAS = '1.488.1';

const NIVEL_ANCORA = 150;
const XP_ANCORA = 0.6 * NIVEL_ANCORA ** 2;
const OURO_KILL_NIVEL_1 = 36;
const OURO_KILL_ANCORA_NIVEL = 5_000;
const OURO_KILL_ANCORA = 6_000;
const EXPOENTE_OURO_KILL =
  Math.log(OURO_KILL_ANCORA / OURO_KILL_NIVEL_1) / Math.log(OURO_KILL_ANCORA_NIVEL);
const NIVEL_TETO_OURO = 25_000;
const TETO_OURO_KILL = Math.round(OURO_KILL_NIVEL_1 * NIVEL_TETO_OURO ** EXPOENTE_OURO_KILL);
const FRACAO_BONUS_LOOT = 0.15;
const EXPOENTE_RENDA = 0.3;

const MS_ONDA = 2600;
const MAX_MOBS = 16;
const CD_GOLPE_MS = 900;
const MS_DESLOC_MS = 600;
const CD_MOVIMENTO_MEDIO_MS = 2000;

export const xpDoNivel = (n: number): number =>
  n <= NIVEL_ANCORA
    ? Math.floor((6 * n * n) / 10) + 8
    : Math.round(XP_ANCORA * (n / NIVEL_ANCORA) ** 1.25);

export const ouroPorKillDoNivel = (n: number): number =>
  Math.min(
    TETO_OURO_KILL,
    Math.max(1, Math.round(OURO_KILL_NIVEL_1 * Math.max(1, Number(n) || 1) ** EXPOENTE_OURO_KILL)),
  );

export function alvoRendaPorKill(nivel: number): number {
  const n = Math.max(1, Number(nivel) || 1);
  const base =
    n <= NIVEL_TETO_OURO
      ? ouroPorKillDoNivel(n)
      : TETO_OURO_KILL * (n / NIVEL_TETO_OURO) ** EXPOENTE_RENDA;
  return Math.round(base * (1 + FRACAO_BONUS_LOOT));
}

export function ouroPorAbate(nivel: number, bonusLootPct = 0): number {
  const base = ouroPorKillDoNivel(nivel);
  const loot = Math.round(
    Math.max(0, alvoRendaPorKill(nivel) - base) * (1 + Math.max(0, bonusLootPct) / 100),
  );
  return base + loot;
}

export function mediaPorAbate(hunt: Hunt): { xp: number; gold: number } {
  return { xp: xpDoNivel(hunt.nivel), gold: ouroPorAbate(hunt.nivel) };
}

export function abatesPorHoraTeorico(hunt: Hunt): number {
  const pontos = hunt.especies.reduce((s, e) => s + e.pontos, 0) || 1;
  const porOnda = Math.min(MAX_MOBS, pontos);
  const segPorOnda =
    (porOnda * (CD_GOLPE_MS + MS_DESLOC_MS + CD_MOVIMENTO_MEDIO_MS) + MS_ONDA) / 1000;
  return (porOnda / segPorOnda) * 3600;
}
