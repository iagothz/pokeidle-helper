export interface ParametrosCombate {
  ampliacaoHunt: number;
  multHpSelvagem: number;
  multDanoSelvagem: number;
  multDanoExtra: number;
  tipoSazonal: string | null;
  escudoSazonal: boolean;
  deslocamentoPorAbateS: number;
  esperaPorOndaS: number;
}

export const PARAMETROS_COMBATE_PADRAO: Readonly<ParametrosCombate> = Object.freeze({
  ampliacaoHunt: 1.5,
  multHpSelvagem: 5,
  multDanoSelvagem: 1.8,
  multDanoExtra: 1,
  tipoSazonal: null,
  escudoSazonal: false,
  deslocamentoPorAbateS: 2.6,
  esperaPorOndaS: 2.6,
});

export interface ParametrosCaptura {
  base: number;
  piso: number;
  teto: number;
  raridadeDiv: number;
}

export const CAPTURA_PADRAO: Readonly<ParametrosCaptura> = Object.freeze({
  base: 0.0075,
  piso: 0.003,
  teto: 0.1,
  raridadeDiv: 17,
});
