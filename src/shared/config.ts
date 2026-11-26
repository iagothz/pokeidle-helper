import * as z from 'zod';
import padrao from '../../config.default.json';
import { NIVEIS } from './logger';

export const esquemaConfig = z.object({
  logLevel: z.enum(NIVEIS),
  sessaoMinimaMs: z.number().int().min(0).max(3_600_000),
  pausaMaximaMs: z.number().int().min(5_000).max(600_000),
  amostraMinimaMs: z.number().int().min(0).max(36_000_000),
  logs: z.object({
    maxBytesPorSegmento: z.number().int().min(10_000).max(50_000_000),
    maxSegmentos: z.number().int().min(1).max(10),
    flushMs: z.number().int().min(200).max(60_000),
  }),
  jogo: z.object({
    origem: z.url(),
    assetsEspecies: z.array(z.string().startsWith('/')).min(1),
    assetItens: z.string().startsWith('/'),
  }),
});

export type Config = z.infer<typeof esquemaConfig>;

export const CONFIG_PADRAO: Config = esquemaConfig.parse(padrao);

export const CHAVE_CONFIG = 'pokeidleHelper.config';

export type OverridesConfig = Partial<
  Pick<Config, 'logLevel' | 'sessaoMinimaMs' | 'pausaMaximaMs' | 'amostraMinimaMs'>
>;

export function mesclarConfig(overrides: unknown): { config: Config; avisos: string[] } {
  const avisos: string[] = [];
  if (overrides == null) return { config: CONFIG_PADRAO, avisos };
  if (typeof overrides !== 'object' || Array.isArray(overrides)) {
    return { config: CONFIG_PADRAO, avisos: ['Configuração salva inválida; usando o padrão.'] };
  }
  const candidato = {
    ...CONFIG_PADRAO,
    ...(overrides as Record<string, unknown>),
    logs: CONFIG_PADRAO.logs,
    jogo: CONFIG_PADRAO.jogo,
  };
  const res = esquemaConfig.safeParse(candidato);
  if (res.success) return { config: res.data, avisos };
  for (const issue of res.error.issues)
    avisos.push(`Configuração "${issue.path.join('.')}" inválida: ${issue.message}`);
  return { config: CONFIG_PADRAO, avisos };
}
