import type { Jogador } from '../../domain/estadoJogo';
import type { Comando } from '../../shared/comandos';
import type { Logger } from '../../shared/logger';

export interface ContextoAutomacao {
  agora(): number;
  jogador(): Jogador | null;
  enviar(comando: Comando, origem: string): boolean;
  log: Logger;
}
