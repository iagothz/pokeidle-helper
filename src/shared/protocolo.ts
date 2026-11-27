export const ORIGEM_PONTE = 'pokeidle-helper';
export const VERSAO_PONTE = 1;
export const VERSAO_JOGO_VALIDADA = '1.492.0';
export const TIPOS_CAPTURADOS = ['welcome', 'estado', 'batalha'] as const;
export type TipoCapturado = (typeof TIPOS_CAPTURADOS)[number];

export interface EnvelopePonte {
  origem: typeof ORIGEM_PONTE;
  v: typeof VERSAO_PONTE;
  tipo: 'mensagem' | 'diagnostico' | 'resultadoComando';
  recebidoEm: number;
  dados: unknown;
}
