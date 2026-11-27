export const AMOSTRA_MINIMA_GOLPES = 20;
export const FRACAO_PERIGO = 0.3;

export interface ContadoresDano {
  golpesRecebidos: number;
  golpesSuperEfetivos: number;
  danoRecebido: number;
}

export interface AvaliacaoDano {
  golpes: number;
  fracaoSuperEfetivos: number;
  danoMedio: number;
  suficiente: boolean;
  perigo: boolean;
}

export function avaliarDanoRecebido(c: ContadoresDano): AvaliacaoDano {
  const golpes = c.golpesRecebidos;
  const fracaoSuperEfetivos = golpes > 0 ? c.golpesSuperEfetivos / golpes : 0;
  const suficiente = golpes >= AMOSTRA_MINIMA_GOLPES;
  return {
    golpes,
    fracaoSuperEfetivos,
    danoMedio: golpes > 0 ? c.danoRecebido / golpes : 0,
    suficiente,
    perigo: suficiente && fracaoSuperEfetivos >= FRACAO_PERIGO,
  };
}
