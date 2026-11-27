import { CAMPOS_AUTO_SET, type Comando } from '../../shared/comandos';
import type { AutomacaoJogo } from '../../domain/schemas';
import type { Jogador } from '../../domain/estadoJogo';
import type { ContextoAutomacao } from './contexto';

export const ESPERA_REENVIO_MS = 5_000;

export function pacoteAutoSet(
  atual: AutomacaoJogo,
  patch: Partial<AutomacaoJogo>,
): Extract<Comando, { t: 'auto.set' }> {
  const campos: Record<string, unknown> = {};
  const fonte = { ...atual, ...patch } as Record<string, unknown>;
  for (const campo of CAMPOS_AUTO_SET) if (fonte[campo] !== undefined) campos[campo] = fonte[campo];
  return { t: 'auto.set', ...campos } as Extract<Comando, { t: 'auto.set' }>;
}

function bolasComEstoque(j: Jogador): number[] {
  return Object.entries(j.bolas)
    .filter(([, q]) => q > 0)
    .map(([id]) => Number(id))
    .sort((a, b) => a - b);
}

export type DecisaoAutoBall =
  'ligou' | 'ja-capturada' | 'ja-ligado' | 'sem-vip' | 'sem-bola' | 'espera';

export class AutoBallDex {
  private ultimoEnvio = -Infinity;

  constructor(private readonly ctx: ContextoAutomacao) {}

  aoSpawn(speciesId: number): DecisaoAutoBall | null {
    const j = this.ctx.jogador();
    if (!j) return null;
    if (j.especiesCapturadas.has(speciesId)) return 'ja-capturada';
    if (!j.vip) return 'sem-vip';
    const a = j.automacao;
    if (a.autoBallAteCapturar || a.autoBallSemParar || a.autoBall) return 'ja-ligado';
    const agora = this.ctx.agora();
    if (agora - this.ultimoEnvio < ESPERA_REENVIO_MS) return 'espera';
    const ballIds = a.ballIds.length ? a.ballIds : bolasComEstoque(j);
    if (!ballIds.length) {
      this.ctx.log.warn('Espécie nova sem bola para capturar', { speciesId });
      return 'sem-bola';
    }
    const pacote = pacoteAutoSet(a, {
      autoBallAteCapturar: true,
      autoBallSemParar: false,
      ballIds,
    });
    if (!this.ctx.enviar(pacote, 'auto-ball-dex')) return null;
    this.ultimoEnvio = agora;
    this.ctx.log.info('Bola até capturar ligada para espécie fora da pokédex', { speciesId });
    return 'ligou';
  }
}
