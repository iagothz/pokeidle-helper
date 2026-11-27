import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import { FILTROS_PADRAO, type FiltrosUi } from '../shared/preferencias';

export interface ContextoFiltros {
  filtros: FiltrosUi;
  definir(parcial: Partial<FiltrosUi>): void;
}

export const FiltrosContexto = createContext<ContextoFiltros>({
  filtros: FILTROS_PADRAO,
  definir: () => undefined,
});

export function usarFiltros(): ContextoFiltros {
  return useContext(FiltrosContexto);
}

export function comMeta(
  metas: Readonly<Record<string, number>>,
  chave: string,
  nivel: number | null,
): Record<string, number> {
  const resto = Object.fromEntries(Object.entries(metas).filter(([k]) => k !== chave));
  return nivel === null ? resto : { ...resto, [chave]: nivel };
}
